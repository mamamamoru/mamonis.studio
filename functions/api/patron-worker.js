// Cloudflare Worker for Stripe Patron Payments
// Deploy this to: patron-worker.YOUR_SUBDOMAIN.workers.dev

// ==================== 環境変数設定 ====================
// Cloudflare Workers環境変数に以下を設定してください：
// STRIPE_SECRET_KEY: StripeのSecret Key (sk_live_... または sk_test_...)
// STRIPE_PUBLISHABLE_KEY: StripeのPublishable Key (pk_live_... または pk_test_...)
// SUCCESS_URL: 支払い成功後のリダイレクトURL (例: https://mamonis.studio/success)
// CANCEL_URL: 支払いキャンセル後のリダイレクトURL (例: https://mamonis.studio/cancel)

export default {
  async fetch(request, env) {
    // CORS設定
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // OPTIONSリクエスト（プリフライト）
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // POSTリクエスト処理
    if (request.method === 'POST' && new URL(request.url).pathname === '/create-checkout-session') {
      try {
        const { amount, type } = await request.json();

        // バリデーション
        if (!amount || amount < 100) {
          return new Response(
            JSON.stringify({ error: '金額は100円以上を指定してください' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!['one-time', 'monthly'].includes(type)) {
          return new Response(
            JSON.stringify({ error: '支援タイプが不正です' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Stripe Checkout Session作成
        const sessionData = {
          payment_method_types: ['card'],
          mode: type === 'monthly' ? 'subscription' : 'payment',
          success_url: env.SUCCESS_URL || 'https://mamonis.studio/success',
          cancel_url: env.CANCEL_URL || 'https://mamonis.studio/cancel',
        };

        if (type === 'monthly') {
          // 毎月支援：サブスクリプション
          sessionData.line_items = [{
            price_data: {
              currency: 'jpy',
              product_data: {
                name: 'MAMONIS Patronage - 毎月支援',
                description: '創作活動を応援する毎月の支援',
              },
              unit_amount: amount,
              recurring: {
                interval: 'month',
              },
            },
            quantity: 1,
          }];
        } else {
          // 単発支援：一回払い
          sessionData.line_items = [{
            price_data: {
              currency: 'jpy',
              product_data: {
                name: 'MAMONIS Patronage - 単発支援',
                description: '創作活動を応援する一回の支援',
              },
              unit_amount: amount,
            },
            quantity: 1,
          }];
        }

        // Stripe APIリクエスト
        const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(sessionData).toString(),
        });

        if (!stripeResponse.ok) {
          const error = await stripeResponse.text();
          console.error('Stripe API Error:', error);
          return new Response(
            JSON.stringify({ error: 'Stripe APIエラーが発生しました' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const session = await stripeResponse.json();

        return new Response(
          JSON.stringify({ url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error) {
        console.error('Error:', error);
        return new Response(
          JSON.stringify({ error: '内部エラーが発生しました' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 404
    return new Response('Not Found', { status: 404 });
  },
};
