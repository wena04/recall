-- Create a table for public profiles
create table users (
  id uuid references auth.users on delete cascade not null primary key,
  imessage_id text,
  notion_token text,
  notion_database_id text,
  updated_at timestamp with time zone,
  created_at timestamp with time zone
);
-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security
alter table users
  enable row level security;

create policy "Public profiles are viewable by everyone." on users
  for select using (true);

create policy "Users can insert their own profile." on users
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on users
  for update using (auth.uid() = id);

-- 知识条目表 (knowledge_items)
CREATE TABLE knowledge_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    original_content_url TEXT,
    summary TEXT,
    notion_page_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

alter table knowledge_items enable row level security;

create policy "Users can view their own knowledge items." on knowledge_items
    for select using (auth.uid() = user_id);

create policy "Users can insert their own knowledge items." on knowledge_items
    for insert with check (auth.uid() = user_id);

create policy "Users can update their own knowledge items." on knowledge_items
    for update using (auth.uid() = user_id);

create policy "Users can delete their own knowledge items." on knowledge_items
    for delete using (auth.uid() = user_id);

-- 创建索引
CREATE INDEX idx_knowledge_items_user_id ON knowledge_items(user_id);
