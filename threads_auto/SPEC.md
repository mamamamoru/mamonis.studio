# ThreadsAuto 技術仕様書

最終更新: 2025-02-13

## 目次

1. [概要](#概要)
2. [機能仕様](#機能仕様)
3. [データベース設計](#データベース設計)
4. [API設計](#api設計)
5. [コスト試算](#コスト試算)
6. [開発スケジュール](#開発スケジュール)

---

## 概要

ThreadsAuto は、Claude AI を使って Threads への投稿を完全自動化するサービス。

### コア機能
- AI による投稿自動生成
- スケジュール投稿
- リプライ自動返信
- 投稿編集機能
- インサイト分析

### ターゲット
- 個人事業主・フリーランス
- SNS 運用を効率化したい小規模事業者
- 複数アカウント運用する個人

---

## 機能仕様

### 1. AI 投稿生成

#### 1.1 会話形式設定
ユーザーと Claude が会話しながら投稿スタイルを定義。

**フロー:**
```
Claude: どんな投稿を作成したいですか？
User: テック系の知見を、デッドパンな口調で
Claude: 了解です。こんな投稿でどうですか？
[プレビュー表示]
User: 完璧
Claude: 設定を保存しました
```

**設定項目:**
- 口調 (tone): deadpan / business / casual / expert
- トピック (topics): tech / business / philosophy / daily
- スタイル (style): insight / storytelling / list / question
- 文字数 (length): short / medium / long
- カスタムプロンプト (customPrompt): 上級者向け

#### 1.2 投稿生成ロジック

**タイミング:**
- 毎日 20:00 に翌日分を一括生成
- 1日の投稿数に応じて必要数生成

**生成フロー:**
```typescript
async function generateTomorrowPosts(accountId: string) {
  const account = await getAccount(accountId)
  const schedule = account.settings.schedule
  const aiProfile = account.activeAIProfile
  
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const slots = calculateTimeSlots(schedule, tomorrow)
  
  for (const slot of slots) {
    const profile = selectProfileForTime(slot, aiProfile)
    
    const content = await generatePost(profile, {
      excludeSimilar: true,
      targetTime: slot,
      trends: await getTrends()
    })
    
    await createPost({
      accountId,
      content,
      scheduledAt: new Date(`${tomorrow.toDateString()} ${slot}`),
      status: account.settings.autoMode ? 'scheduled' : 'pending_approval',
      aiProfileId: profile.id
    })
  }
  
  await notify(account.userId, {
    type: 'posts_generated',
    count: slots.length,
    date: tomorrow
  })
}
```

**品質管理:**
- 文字数チェック (500文字以内)
- 禁止ワードフィルター
- 重複チェック（過去投稿との類似度）
- センシティブコンテンツ判定

---

### 2. 投稿編集機能

#### 2.1 基本編集
- テキストの直接編集
- リアルタイム文字数カウント
- バリデーション

#### 2.2 クイック編集

**もっと短く:**
```typescript
async function shortenPost(content: string) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `以下の投稿を、意味を保ちながら短くしてください（目標: 50-80文字）:

"${content}"`
    }]
  })
  return response.content[0].text
}
```

**もっと長く:**
```typescript
async function expandPost(content: string) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `以下の投稿を、具体例や説明を加えて詳しくしてください（目標: 150-250文字）:

"${content}"`
    }]
  })
  return response.content[0].text
}
```

**トーン変更:**
- カジュアル化
- フォーマル化
- 技術的に
- ユーモラスに

**完全再生成:**
- 元のプロンプトで新しい投稿を生成
- 既存内容との重複を避ける

#### 2.3 編集履歴
すべての編集をデータベースに記録。

---

### 3. スケジュール投稿

#### 3.1 設定項目

**投稿頻度:**
- 1日の投稿数: 1-5回
- 投稿曜日: 毎日 / 平日のみ / カスタム

**時間帯:**
- 朝 (07:00-10:00)
- 昼 (12:00-14:00)
- 夕 (17:00-19:00)
- 夜 (20:00-22:00)

**オプション:**
- 時間帯内でランダム化
- 最低投稿間隔 (3時間 / 6時間 / 12時間)

#### 3.2 投稿モード

**セーフモード (デフォルト):**
```
生成 → 承認待ち → ユーザー承認 → 投稿
```

**完全自動モード:**
```
生成 → 品質チェック → 自動投稿 → 通知
```

#### 3.3 Cron 実装

**投稿実行 (毎時実行):**
```typescript
export default {
  async scheduled(event, env, ctx) {
    const now = new Date()
    
    // 現在時刻±5分の予約投稿を取得
    const posts = await env.DB.prepare(`
      SELECT * FROM posts
      WHERE status = 'scheduled'
      AND scheduledAt BETWEEN ? AND ?
    `).bind(
      new Date(now.getTime() - 5 * 60 * 1000),
      new Date(now.getTime() + 5 * 60 * 1000)
    ).all()
    
    for (const post of posts.results) {
      await publishPost(post, env)
    }
  }
}
```

---

### 4. リプライ自動返信

#### 4.1 検知システム

**Polling (15分間隔):**
```typescript
async function checkNewReplies() {
  const recentPosts = await db.query(`
    SELECT * FROM posts 
    WHERE posted_at > datetime('now', '-24 hours')
    AND status = 'posted'
  `).all()
  
  for (const post of recentPosts) {
    const replies = await threadsAPI.getReplies(post.threads_post_id)
    
    for (const reply of replies) {
      const exists = await db.query(
        'SELECT * FROM replies WHERE threads_reply_id = ?',
        [reply.id]
      ).first()
      
      if (!exists) {
        await handleNewReply(post, reply)
      }
    }
  }
}
```

#### 4.2 返信生成

**基本プロンプト:**
```typescript
const generateReply = async (
  originalPost: string,
  replyText: string,
  userContext: AIProfile
) => {
  const prompt = `
あなたの投稿: "${originalPost}"

誰かのリプライ: "${replyText}"

あなたのスタイル: ${userContext.tone}

このリプライに対して、自然で適切な返信を生成してください。
以下の点に注意:
- 簡潔に（50文字以内推奨）
- フレンドリーに
- 質問があれば答える
- 感謝や共感を示す
`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }]
  })
  
  return response.content[0].text
}
```

#### 4.3 返信モード

**セーフモード:**
```
検知 → AI生成 → ダッシュボード表示 → ユーザー承認 → 返信
```

**自動返信モード:**
```
検知 → AI生成 → 品質チェック → 自動返信 → 通知
```

**条件付き自動返信:**
- 短いリプライ (10文字以内) → 自動
- ポジティブなリプライ → 自動
- 質問 → 承認必要
- ネガティブ → 承認必要

#### 4.4 高度な機能

**センチメント分析:**
```typescript
async function analyzeSentiment(text: string) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `以下のテキストの感情を分析してください。
      "positive", "neutral", "negative" のいずれかで答えてください。
      また、質問かどうかも判定してください。
      
      テキスト: "${text}"
      
      JSON形式で回答:
      {"sentiment": "...", "is_question": true/false}`
    }]
  })
  
  return JSON.parse(response.content[0].text)
}
```

**スパム検出:**
- ブラックリストチェック
- 短時間大量リプライ検出
- リンク大量含有チェック

---

### 5. インサイト分析

#### 5.1 取得データ
- いいね数
- 返信数
- リポスト数
- 閲覧数
- フォロワー数推移

#### 5.2 分析機能
- 投稿パフォーマンス比較
- 時間帯別エンゲージメント
- ベスト投稿ランキング
- AI設定別の効果測定

---

## データベース設計

### users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  threads_user_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  
  access_token TEXT NOT NULL,
  token_expires_at DATETIME,
  refresh_token TEXT,
  
  plan TEXT DEFAULT 'free',
  stripe_customer_id TEXT,
  trial_ends_at DATETIME,
  
  language TEXT DEFAULT 'ja',
  timezone TEXT DEFAULT 'Asia/Tokyo',
  notification_email BOOLEAN DEFAULT true,
  notification_push BOOLEAN DEFAULT false,
  
  onboarding_completed BOOLEAN DEFAULT false,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_threads_id ON users(threads_user_id);
CREATE INDEX idx_users_stripe_id ON users(stripe_customer_id);
```

### threads_accounts
```sql
CREATE TABLE threads_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  threads_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  
  access_token TEXT NOT NULL,
  token_expires_at DATETIME,
  
  settings JSON,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_accounts_user ON threads_accounts(user_id);
```

### ai_profiles
```sql
CREATE TABLE ai_profiles (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  
  settings JSON NOT NULL,
  conversation JSON,
  
  used_count INTEGER DEFAULT 0,
  last_used_at DATETIME,
  avg_engagement REAL DEFAULT 0,
  
  schedule_config JSON,
  is_active BOOLEAN DEFAULT true,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (account_id) REFERENCES threads_accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_profiles_account ON ai_profiles(account_id);
```

### posts
```sql
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  ai_profile_id TEXT,
  
  content TEXT NOT NULL,
  media_urls JSON,
  
  status TEXT DEFAULT 'draft',
  scheduled_at DATETIME,
  posted_at DATETIME,
  
  threads_post_id TEXT,
  threads_permalink TEXT,
  
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  generated_by TEXT DEFAULT 'ai',
  approved_by TEXT,
  approved_at DATETIME,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (account_id) REFERENCES threads_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (ai_profile_id) REFERENCES ai_profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_posts_account ON posts(account_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_scheduled ON posts(scheduled_at);
```

### post_edits
```sql
CREATE TABLE post_edits (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  
  original_content TEXT NOT NULL,
  edited_content TEXT NOT NULL,
  edit_type TEXT,
  
  edited_by TEXT NOT NULL,
  edited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX idx_post_edits_post ON post_edits(post_id);
```

### replies
```sql
CREATE TABLE replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  threads_reply_id TEXT UNIQUE NOT NULL,
  
  author_username TEXT NOT NULL,
  author_id TEXT NOT NULL,
  reply_text TEXT NOT NULL,
  replied_at DATETIME NOT NULL,
  
  our_reply_text TEXT,
  our_reply_status TEXT DEFAULT 'pending',
  our_reply_posted_at DATETIME,
  our_threads_reply_id TEXT,
  
  sentiment TEXT,
  is_question BOOLEAN DEFAULT false,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX idx_replies_post ON replies(post_id);
CREATE INDEX idx_replies_status ON replies(our_reply_status);
```

### reply_settings
```sql
CREATE TABLE reply_settings (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  
  auto_reply_enabled BOOLEAN DEFAULT false,
  auto_reply_on_short BOOLEAN DEFAULT true,
  auto_reply_on_positive BOOLEAN DEFAULT true,
  require_approval_on_question BOOLEAN DEFAULT true,
  require_approval_on_negative BOOLEAN DEFAULT true,
  
  ignore_users JSON,
  keyword_blacklist JSON,
  
  max_replies_per_hour INTEGER DEFAULT 10,
  reply_delay_minutes INTEGER DEFAULT 5,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (account_id) REFERENCES threads_accounts(id) ON DELETE CASCADE
);
```

### insights
```sql
CREATE TABLE insights (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  
  likes INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  reposts INTEGER DEFAULT 0,
  quotes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  
  engagement_rate REAL DEFAULT 0,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX idx_insights_post ON insights(post_id);
```

### subscriptions
```sql
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_price_id TEXT NOT NULL,
  
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  
  current_period_start DATETIME NOT NULL,
  current_period_end DATETIME NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at DATETIME,
  
  trial_start DATETIME,
  trial_end DATETIME,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
```

---

## API設計

### 認証
```
POST /api/auth/threads/oauth
GET  /api/auth/threads/callback
POST /api/auth/logout
GET  /api/auth/me
```

### アカウント
```
GET    /api/accounts
POST   /api/accounts
PUT    /api/accounts/:id
DELETE /api/accounts/:id
```

### 投稿
```
GET    /api/posts
POST   /api/posts
PUT    /api/posts/:id
DELETE /api/posts/:id
POST   /api/posts/:id/publish
POST   /api/posts/:id/quick-edit
POST   /api/posts/:id/draft
GET    /api/posts/:id/edits
```

### AI生成
```
POST /api/generate
POST /api/ai-profiles
GET  /api/ai-profiles
PUT  /api/ai-profiles/:id
DELETE /api/ai-profiles/:id
POST /api/ai-profiles/:id/chat
```

### リプライ
```
GET  /api/replies
POST /api/replies/:id/approve
POST /api/replies/:id/post
PUT  /api/reply-settings/:accountId
```

### インサイト
```
GET /api/insights/:accountId
GET /api/insights/post/:postId
```

### サブスクリプション
```
GET  /api/subscription
POST /api/subscription/create
POST /api/subscription/cancel
POST /api/subscription/update
```

---

## コスト試算

### Claude API (1,000ユーザー想定)

**投稿生成:**
- 1投稿: Input 500 tokens / Output 200 tokens
- コスト: $0.0045/投稿
- 月間44,000投稿: $198

**最適化後:**
- キャッシング + バッチ生成
- コスト: $0.00315/投稿
- 月間44,000投稿: $139

**リプライ返信:**
- 1返信: Input 300 tokens / Output 100 tokens
- コスト: $0.003/返信
- 月間5,000返信: $15

**編集機能:**
- クイック編集: $0.002/回
- 月間2,000回: $4

**合計: $158/月**

### Cloudflare
- Workers: 無料枠内
- D1: 無料枠内（10GB まで）
- KV: 無料枠内
- **合計: $5-20/月**

### Stripe手数料
- 月間収益 $418,000
- 手数料 3.6%: $15,048

### 総コスト
- API: $158
- Cloudflare: $20
- Stripe: $15,048
- **合計: $15,226**

### 利益
- 収益: $418,000
- コスト: $15,226
- **利益: $402,774**
- **利益率: 96.4%**

---

## 開発スケジュール

### Phase 1: MVP (Week 1-6)
- Week 1-2: 基盤構築、認証
- Week 3-4: AI生成、投稿管理、編集機能
- Week 5-6: スケジューリング、自分でテスト

### Phase 2: Release (Week 7-10)
- Week 7-8: Stripe統合、プラン管理
- Week 9: AI設定会話UI、リプライ機能（セーフモード）
- Week 10: 品質向上、ベータテスト

### Phase 3: Growth (Week 11-16)
- リプライ完全自動モード
- センチメント分析
- 画像投稿対応
- 複数アカウント拡張

---

## 次のステップ

1. GitHub リポジトリ作成
2. プロジェクトセットアップ (Next.js + Cloudflare)
3. 認証システム実装
4. AI生成機能実装
5. MVP リリース

---

© 2025 ThreadsAuto by mamonis.studio
