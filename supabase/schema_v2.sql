-- ============================================================
-- Allreview MVP – Schema Update for Keyword Reviews
-- ============================================================

-- Create Keyword Reviews Table
CREATE TABLE IF NOT EXISTS public.keyword_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword_id uuid REFERENCES public.keywords(id) ON DELETE CASCADE,
  content text NOT NULL,
  spicy_votes integer DEFAULT 0,
  cider_votes integer DEFAULT 0,
  angry_votes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on Row Level Security
ALTER TABLE public.keyword_reviews ENABLE ROW LEVEL SECURITY;

-- Anonymous users can read keyword reviews
CREATE POLICY "Enable read access for all users on keyword_reviews" ON public.keyword_reviews
  FOR SELECT USING (true);

-- Anonymous users can insert keyword reviews
CREATE POLICY "Enable insert access for all users on keyword_reviews" ON public.keyword_reviews
  FOR INSERT WITH CHECK (true);

-- Anonymous users can update keyword votes
CREATE POLICY "Enable update access for all users on keyword_reviews" ON public.keyword_reviews
  FOR UPDATE USING (true);

-- Create index for faster fetches
CREATE INDEX IF NOT EXISTS idx_keyword_reviews_keyword_id ON public.keyword_reviews(keyword_id);
