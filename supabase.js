import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = window.__ENV__?.SUPABASE_URL  || 'https://fdbfvntqdgcrdwiwctmm.supabase.co';
const SUPABASE_KEY  = window.__ENV__?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkYmZ2bnRxZGdjcmR3aXdjdG1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNTQzNTksImV4cCI6MjA4NzYzMDM1OX0.2UuZbhX1mKu4aTtTlrt34WBR3ZyGlAd4LEbNOKcSJN8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&q=80';


export async function fetchPublishedPosts() {
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, slug, excerpt, featured_image, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}


export async function fetchPostBySlug(slug) {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (error) throw error;
  return data;
}

export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    year : 'numeric',
    month: 'long',
    day  : 'numeric',
  });
}
// Like a post
export async function likePost(post_id, user_id = null) {
  const { data, error } = await supabase
    .from('post_likes')
    .insert([{ post_id, user_id }])
    .select();
  if (error) throw error;
  return data;
}

// Fetch likes for a post
export async function fetchPostLikes(post_id) {
  const { data, error } = await supabase
    .from('post_likes')
    .select('*')
    .eq('post_id', post_id);
  if (error) throw error;
  return data;
}

// Add comment
export async function addComment(post_id, user_name, content) {
  const { data, error } = await supabase
    .from('post_comments')
    .insert([{ post_id, user_name, content }])
    .select();
  if (error) throw error;
  return data;
}

// Fetch comments
export async function fetchComments(post_id) {
  const { data, error } = await supabase
    .from('post_comments')
    .select('*, comment_replies(*)')
    .eq('post_id', post_id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

// Add reply
export async function addReply(comment_id, user_name, content) {
  const { data, error } = await supabase
    .from('comment_replies')
    .insert([{ comment_id, user_name, content }])
    .select();
  if (error) throw error;
  return data;
}