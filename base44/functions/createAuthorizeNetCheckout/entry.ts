import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { cart, totals } = await req.json();

    if (!cart || cart.length === 0) {
      return Response.json({ error: 'Cart is empty' }, { status: 400 });
    }

    if (!totals) {
      return Response.json({ error: 'Totals missing' }, { status: 400 });
    }

    const apiLoginId = Deno.env.get('AUTHORIZENET_API_LOGIN_ID');
    const transactionKey = Deno.env.get('AUTHORIZENET_TRANSACTION_KEY');
    const isSandbox = Deno.env.get('AUTHORIZENET_SANDBOX') === 'true';

    const apiUrl = isSandbox
      ? 'https://apitest.authorize.net/xml/v1/request.api'
      : 'https://api.authorize.net/xml/v1/request.api';

    // Use totals from frontend
    const total = totals.total.toFixed(2);

    // Build line items (products + taxes)
    const lineItems = cart.map(item => ({
      itemId: item.id,
      name: item.name.substring(0, 31),
      description: item.options ? Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(', ').substring(0, 255) : '',
      quantity: item.quantity.toString(),
      unitPrice: parseFloat(item.price.replace(/[^0-9.]/g, '')).toFixed(2)
    }));

    // Add taxes as line items
    lineItems.push({
      itemId: 'TPS',
      name: 'TPS (5%)',
      description: 'Taxe fédérale',
      quantity: '1',
      unitPrice: totals.tps.toFixed(2)
    });

    lineItems.push({
      itemId: 'TVQ',
      name: 'TVQ (9.975%)',
      description: 'Taxe provinciale',
      quantity: '1',
      unitPrice: totals.tvq.toFixed(2)
    });

    if (totals.shipping > 0) {
      lineItems.push({
        itemId: 'SHIPPING',
        name: 'Livraison',
        description: 'Frais de livraison',
        quantity: '1',
        unitPrice: totals.shipping.toFixed(2)
      });
    }

    // Create hosted payment page request
    const requestBody = {
      getHostedPaymentPageRequest: {
        merchantAuthentication: {
          name: apiLoginId,
          transactionKey: transactionKey
        },
        transactionRequest: {
          transactionType: 'authCaptureTransaction',
          amount: total,
          lineItems: {
            lineItem: lineItems
          },
          customer: {
            email: user.email
          },
          billTo: {
            firstName: '',
            lastName: ''
          },
          shipTo: {
            firstName: '',
            lastName: ''
          },
          userFields: {
            userField: [
              {
                name: 'cart_data',
                value: JSON.stringify(cart).substring(0, 255)
              },
              {
                name: 'user_email',
                value: user.email
              }
            ]
          }
        },
        hostedPaymentSettings: {
          setting: [
            {
              settingName: 'hostedPaymentReturnOptions',
              settingValue: JSON.stringify({
                showReceipt: true,
                url: `${req.headers.get('origin')}/cart?payment=success`,
                urlText: 'Retour à la boutique',
                cancelUrl: `${req.headers.get('origin')}/cart?payment=cancelled`,
                cancelUrlText: 'Annuler'
              })
            },
            {
              settingName: 'hostedPaymentButtonOptions',
              settingValue: JSON.stringify({
                text: 'Payer'
              })
            },
            {
              settingName: 'hostedPaymentStyleOptions',
              settingValue: JSON.stringify({
                bgColor: '#000000'
              })
            },
            {
              settingName: 'hostedPaymentBillingAddressOptions',
              settingValue: JSON.stringify({
                show: true,
                required: true
              })
            },
            {
              settingName: 'hostedPaymentShippingAddressOptions',
              settingValue: JSON.stringify({
                show: true,
                required: true
              })
            },
            {
              settingName: 'hostedPaymentCustomerOptions',
              settingValue: JSON.stringify({
                showEmail: true,
                requiredEmail: true
              })
            }
          ]
        }
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (data.messages.resultCode === 'Ok') {
      const token = data.token;
      const hostedPaymentUrl = isSandbox
        ? `https://test.authorize.net/payment/payment`
        : `https://accept.authorize.net/payment/payment`;

      return Response.json({
        url: `${hostedPaymentUrl}?token=${token}`
      });
    } else {
      return Response.json({
        error: data.messages.message[0].text
      }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});