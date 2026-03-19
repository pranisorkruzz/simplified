import { EmailBrief, parseBriefPayload } from '@/lib/briefs';
import { getSupabaseErrorMessage, supabase } from '@/lib/supabase';

type CreatedBriefResponse = {
  brief: EmailBrief;
  assistantChat: {
    id: string;
    created_at: string;
  };
};

export async function createBriefFromEmail(
  emailText: string
): Promise<CreatedBriefResponse> {
  const { data, error } = await supabase.functions.invoke('summarize-email', {
    body: {
      emailText,
    },
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, 'Failed to summarize email'));
  }

  const brief = parseBriefPayload(data?.brief);
  const assistantChatId = data?.assistantChat?.id;
  const assistantChatCreatedAt = data?.assistantChat?.created_at;

  if (!brief || !assistantChatId || !assistantChatCreatedAt) {
    throw new Error('Invalid summarize-email response');
  }

  return {
    brief,
    assistantChat: {
      id: assistantChatId,
      created_at: assistantChatCreatedAt,
    },
  };
}
