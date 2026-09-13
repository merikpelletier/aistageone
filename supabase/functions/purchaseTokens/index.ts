import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

serveWithCors(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { package_id } = await req.json();

    if (!package_id) {
      return Response.json({ error: 'Package ID required' }, { status: 400 });
    }

    // Get token package details
    const tokenPackage = await base44.entities.TokenPackage.get(package_id);
    if (!tokenPackage || !tokenPackage.is_active) {
      return Response.json({ error: 'Invalid package' }, { status: 400 });
    }

    const apiLoginId = Deno.env.get('AUTHORIZENET_API_LOGIN_ID');
    const transactionKey = Deno.env.get('AUTHORIZENET_TRANSACTION_KEY');
    const isSandbox = Deno.env.get('AUTHORIZENET_SANDBOX') === 'true';

    const apiUrl = isSandbox
      ? 'https://apitest.authorize.net/xml/v1/request.api'
      : 'https://api.authorize.net/xml/v1/request.api';

    const total = tokenPackage.price.toFixed(2);

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
            lineItem: [
              {
                itemId: tokenPackage.id,
                name: `${tokenPackage.name} - ${tokenPackage.token_amount} Tokens`,
                description: tokenPackage.bonus_percentage > 0 
                  ? `${tokenPackage.token_amount} tokens + ${tokenPackage.bonus_percentage}% bonus`
                  : `${tokenPackage.token_amount} tokens`,
                quantity: '1',
                unitPrice: total
              }
            ]
          },
          customer: {
            email: user.email
          },
          userFields: {
            userField: [
              {
                name: 'package_id',
                value: tokenPackage.id
              },
              {
                name: 'token_amount',
                value: tokenPackage.token_amount.toString()
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
                url: `${req.headers.get('origin')}/studio?payment=success`,
                urlText: 'Return to Studio',
                cancelUrl: `${req.headers.get('origin')}/studio?payment=cancelled`,
                cancelUrlText: 'Cancel'
              })
            },
            {
              settingName: 'hostedPaymentButtonOptions',
              settingValue: JSON.stringify({
                text: 'Pay Now'
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