import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

serveWithCors(async (req) => {
  try {
    // Initialize Base44 client FIRST (before any crypto operations)
    const base44 = createClientFromRequest(req);

    // Get webhook payload
    const body = await req.text();
    const signature = req.headers.get('x-anet-signature');

    // Validate signature
    const sigParts = signature?.split('=');
    if (!sigParts || sigParts[0] !== 'sha512') {
      return Response.json({ error: 'Invalid signature format' }, { status: 401 });
    }

    const webhookSignature = sigParts[1];
    const signatureKey = Deno.env.get('AUTHORIZENET_SIGNATURE_KEY');

    if (!signatureKey) {
      return Response.json({ error: 'Signature key not configured' }, { status: 500 });
    }

    // Verify signature using Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(signatureKey),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );

    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    if (computedSignature !== webhookSignature.toUpperCase()) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse webhook data
    const data = JSON.parse(body);
    const eventType = data.eventType;
    const payload = data.payload;

    console.log('Webhook received:', eventType);

    // Handle successful payment
    if (eventType === 'net.authorize.payment.authcapture.created') {
      const transactionId = payload.id;
      const authAmount = parseFloat(payload.authAmount);
      
      // Extract customer info
      const billTo = payload.billTo || {};
      const shipTo = payload.shipTo || {};
      const customerEmail = payload.customer?.email || billTo.email || '';

      // Extract cart data from userFields if available
      let cartItems = [];
      const userFields = payload.userFields || [];
      const cartDataField = userFields.find(f => f.name === 'cart_data');
      
      if (cartDataField) {
        try {
          cartItems = JSON.parse(cartDataField.value);
        } catch (e) {
          console.log('Could not parse cart data from userFields');
        }
      }

      // Calculate breakdown (rough estimate if cart not available)
      const subtotal = authAmount / 1.14975; // Reverse calculate before taxes
      const tps = subtotal * 0.05;
      const tvq = subtotal * 0.09975;

      // Check if this is a token purchase
      const isTokenPurchase = cartItems.some(item => item.id?.includes('token_package'));
      
      if (isTokenPurchase && customerEmail) {
        // Find the token package from cart
        const tokenItem = cartItems.find(item => item.id?.includes('token_package'));
        if (tokenItem) {
          const tokenAmount = parseInt(tokenItem.name.match(/(\d+)/)?.[1] || '0');
          
          if (tokenAmount > 0) {
            // Get or create user's token balance
            let balance = await base44.asServiceRole.entities.UserTokenBalance.filter({ user_email: customerEmail }).then(r => r[0]);
            
            if (!balance) {
              balance = await base44.asServiceRole.entities.UserTokenBalance.create({
                user_email: customerEmail,
                balance: 0,
                last_updated: new Date().toISOString()
              });
            }
            
            // Update balance
            const newBalance = balance.balance + tokenAmount;
            await base44.asServiceRole.entities.UserTokenBalance.update(balance.id, {
              balance: newBalance,
              last_updated: new Date().toISOString()
            });
            
            // Create transaction record
            await base44.asServiceRole.entities.TokenTransaction.create({
              user_email: customerEmail,
              transaction_type: 'purchase',
              token_amount: tokenAmount,
              balance_after: newBalance,
              payment_id: transactionId,
              created_at: new Date().toISOString()
            });
            
            console.log(`Token purchase: ${customerEmail} bought ${tokenAmount} tokens, new balance: ${newBalance}`);
          }
        }
      }
      
      // Create order record
      const order = await base44.asServiceRole.entities.Order.create({
        order_id: transactionId,
        items: cartItems,
        subtotal: parseFloat(subtotal.toFixed(2)),
        tps: parseFloat(tps.toFixed(2)),
        tvq: parseFloat(tvq.toFixed(2)),
        shipping: 0,
        total: authAmount,
        customer_email: customerEmail,
        customer_name: `${billTo.firstName || ''} ${billTo.lastName || ''}`.trim(),
        shipping_address: {
          street: shipTo.address || '',
          city: shipTo.city || '',
          state: shipTo.state || '',
          zip: shipTo.zip || '',
          country: shipTo.country || ''
        },
        status: 'completed',
        payment_date: new Date().toISOString()
      });

      // Send email notification to admin
      const adminEmail = 'merik@sckript.com';
      
      const itemsList = cartItems.map(item => {
        const options = item.options ? 
          Object.entries(item.options).map(([k, v]) => `  ${k}: ${v}`).join('\n') : '';
        return `- ${item.name} (${item.price}) x${item.quantity}\n${options}`;
      }).join('\n');

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: adminEmail,
        subject: `Nouvelle commande - ${transactionId}`,
        body: `
Nouvelle commande reçue !

Transaction ID: ${transactionId}
Montant total: ${authAmount.toFixed(2)} $

Client:
${order.customer_name}
${customerEmail}

Adresse de livraison:
${order.shipping_address.street}
${order.shipping_address.city}, ${order.shipping_address.state} ${order.shipping_address.zip}
${order.shipping_address.country}

Articles commandés:
${itemsList}

Sous-total: ${subtotal.toFixed(2)} $
TPS (5%): ${tps.toFixed(2)} $
TVQ (9.975%): ${tvq.toFixed(2)} $
Total: ${authAmount.toFixed(2)} $

Date: ${new Date().toLocaleString('fr-CA')}
        `.trim()
      });

      console.log('Order created and notification sent:', order.id);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
