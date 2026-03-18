/*
  # Initial Schema Setup for AI Study Assistant App

  ## Overview
  This migration creates the foundation for a mobile AI study assistant app with chat functionality,
  task management, and user profiles.

  ## New Tables
  
  ### 1. `profiles`
  Stores user profile information including their role (student or professional)
  - `id` (uuid, primary key) - References auth.users
  - `user_type` (text) - Either 'student' or 'professional'
  - `created_at` (timestamptz) - When profile was created
  - `updated_at` (timestamptz) - Last profile update
  
  ### 2. `chats`
  Stores conversation history between user and AI
  - `id` (uuid, primary key)
  - `user_id` (uuid) - References auth.users
  - `message` (text) - The message content
  - `role` (text) - Either 'user' or 'assistant'
  - `file_urls` (text[]) - Array of uploaded file URLs (if any)
  - `created_at` (timestamptz)
  
  ### 3. `tasks`
  Stores AI-generated tasks/steps from chat responses
  - `id` (uuid, primary key)
  - `user_id` (uuid) - References auth.users
  - `chat_id` (uuid) - References chats table
  - `title` (text) - Task title/description
  - `order_index` (integer) - Order of the task in the list
  - `completed` (boolean) - Whether task is checked off
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Users can only read/write their own data
  - Authenticated users only
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type text NOT NULL CHECK (user_type IN ('student', 'professional')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  file_urls text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chats"
  ON chats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chats"
  ON chats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chats"
  ON chats FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id uuid REFERENCES chats(id) ON DELETE CASCADE,
  title text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_chat_id ON tasks(chat_id);