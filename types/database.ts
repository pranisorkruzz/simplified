export type UserType = 'student' | 'professional';

export interface Profile {
  id: string;
  user_type: UserType;
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: string;
  user_id: string;
  message: string;
  role: 'user' | 'assistant';
  file_urls?: string[];
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  chat_id: string | null;
  title: string;
  order_index: number;
  completed: boolean;
  created_at: string;
}
