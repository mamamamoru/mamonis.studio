# ThreadsAuto

AI-powered automatic posting system for Threads.

## Overview

ThreadsAuto は、Claude AI を使って Threads への投稿を完全自動化するサービスです。

- AI がコンテンツを自動生成
- スケジュール投稿を自動実行
- インサイト分析で効果測定
- 多言語対応（日本語・英語・中国語）

## Features

- **AI Generation**: Claude API でユーザーのスタイルに合わせた投稿を自動生成
- **Auto Schedule**: 設定した時間に自動投稿
- **Conversation-based Setup**: 会話形式で AI 設定を作成
- **Multi-account Support**: 複数の Threads アカウントを一元管理
- **Insights**: エンゲージメント分析とレポート
- **Multilingual**: 日本語・英語・中国語に対応

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- Tailwind CSS
- TypeScript

### Backend
- Cloudflare Workers
- Cloudflare D1 (SQLite)
- Cloudflare KV

### External APIs
- Claude API (Anthropic)
- Threads API
- Stripe (Payment)
- Resend (Email)

## Architecture

```
User
  ↓
Next.js (Cloudflare Pages)
  ↓
Cloudflare Workers
  ├─ Cron Jobs (投稿生成・実行)
  ├─ D1 Database
  └─ KV Store
  ↓
External APIs
  ├─ Claude API (AI 生成)
  ├─ Threads API (投稿実行)
  └─ Stripe (決済)
```

## Database Schema

- `users` - ユーザー情報
- `threads_accounts` - Threads アカウント
- `ai_profiles` - AI 設定プロフィール
- `posts` - 投稿データ
- `insights` - インサイトデータ
- `subscriptions` - サブスクリプション

詳細は `/docs/SPEC.md` を参照。

## Pricing

- **Free**: 月5投稿まで
- **Lite**: $9.8/月 - 1日3投稿、1アカウント
- **Pro**: $24.8/月 - 投稿無制限、3アカウント
- **Business**: $98/月 - 投稿無制限、10アカウント

## Development

### Prerequisites

- Node.js 20+
- pnpm
- Cloudflare account
- Claude API key
- Threads API credentials

### Setup

```bash
# Clone repository
git clone https://github.com/mamonis/threadsauto.git
cd threadsauto

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env.local

# Run development server
pnpm dev
```

### Environment Variables

```env
# Threads API
THREADS_CLIENT_ID=
THREADS_CLIENT_SECRET=
THREADS_REDIRECT_URI=

# Claude API
ANTHROPIC_API_KEY=

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_DATABASE_ID=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Other
ENCRYPTION_KEY=
NEXTAUTH_SECRET=
```

## Roadmap

### Phase 1: MVP (Week 1-6)
- [x] UI/UX デザイン
- [ ] 認証システム (Threads OAuth)
- [ ] AI 生成機能
- [ ] スケジュール投稿
- [ ] ダッシュボード

### Phase 2: Release (Week 7-10)
- [ ] Stripe 決済統合
- [ ] 複数アカウント対応
- [ ] インサイト取得
- [ ] 会話形式 AI 設定

### Phase 3: Growth (Week 11-16)
- [ ] 画像投稿対応
- [ ] RSS 連携
- [ ] A/B テスト機能
- [ ] チーム機能

## Contributing

現在プライベートプロジェクトのため、外部からの貢献は受け付けていません。

## License

Proprietary - All rights reserved

## Author

mamonis.studio
- Website: https://mamonis.studio
- X: https://x.com/mamonis

---

© 2025 ThreadsAuto by mamonis.studio
