-- ============================================================
-- Allreview MVP – Supabase PostgreSQL Schema
-- Run this SQL in Supabase SQL Editor to initialize the DB
-- ============================================================

-- 1. Keywords table
CREATE TABLE IF NOT EXISTS keywords (
  id          BIGSERIAL PRIMARY KEY,
  keyword_name TEXT        NOT NULL,
  country_code VARCHAR(5)  NOT NULL DEFAULT 'GL',
  is_global   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for country-based lookup
CREATE INDEX IF NOT EXISTS idx_keywords_country ON keywords(country_code);

-- 2. Images table
CREATE TABLE IF NOT EXISTS images (
  id                BIGSERIAL PRIMARY KEY,
  keyword_id        BIGINT      NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  image_url         TEXT        NOT NULL,
  uploader_nickname TEXT        NOT NULL DEFAULT 'Allreview Bot 🤖',
  uploader_country  VARCHAR(5)  NOT NULL DEFAULT 'GL',
  win_count         INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_images_keyword ON images(keyword_id);
CREATE INDEX IF NOT EXISTS idx_images_wins    ON images(win_count DESC);

-- 3. Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id           BIGSERIAL PRIMARY KEY,
  image_id     BIGINT      NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  nickname     TEXT        NOT NULL DEFAULT 'Anonymous',
  content      TEXT        NOT NULL,
  spicy_votes  INTEGER     NOT NULL DEFAULT 0,
  cider_votes  INTEGER     NOT NULL DEFAULT 0,
  angry_votes  INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_image ON reviews(image_id);
CREATE INDEX IF NOT EXISTS idx_reviews_spicy ON reviews(spicy_votes DESC);

-- 4. Supabase Storage bucket (run via Supabase Dashboard or API)
-- CREATE BUCKET 'user-uploads' with public access

-- 5. Row Level Security (open for MVP anonymous access)
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE images   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews  ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read on all tables
CREATE POLICY "anon_read_keywords" ON keywords FOR SELECT USING (true);
CREATE POLICY "anon_read_images"   ON images   FOR SELECT USING (true);
CREATE POLICY "anon_read_reviews"  ON reviews  FOR SELECT USING (true);

-- Allow anonymous insert on images & reviews
CREATE POLICY "anon_insert_images"  ON images  FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_insert_reviews" ON reviews  FOR INSERT WITH CHECK (true);

-- Allow anonymous update on images (win_count increment)
CREATE POLICY "anon_update_images" ON images FOR UPDATE USING (true) WITH CHECK (true);

-- Allow anonymous update on reviews (vote increments)
CREATE POLICY "anon_update_reviews" ON reviews FOR UPDATE USING (true) WITH CHECK (true);
