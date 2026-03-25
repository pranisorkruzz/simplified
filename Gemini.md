# App: Clarix

AI-powered task management app that breaks tasks into visual steps.

## Features
- User inputs a task → AI validates it
- AI asks 5 follow-up questions one by one
- Generates a visual flowchart (JSON) as task breakdown
- Each flowchart node is tappable → opens bottom sheet
- Bottom sheet has Kanban board + chatbot per subtask
- User marks subtasks done → turns green → saves to Supabase

## Tech Stack
- React Native + Expo
- Supabase (auth + database + edge functions)
- TypeScript
- Gemini API
- AsyncStorage

## Structure
- `app/(tabs)/` — Briefs, Tasks, Profile tabs
- `components/` — BriefComposer, BriefCard, BriefKanbanBoard, TaskFlowchart, BriefFollowUpSheet, TaskCard
- `lib/` — gemini.ts, briefs.ts, auth.ts, supabase.ts
- `contexts/` — AuthContext, KanbanContext
- `supabase/functions/` — edge functions

## Rules
- Match existing font and color scheme
- No italic fonts
- TypeScript strictly
- Save to Supabase + AsyncStorage
- Never add dependencies without asking
- Never change navigation structure
- All screens use KeyboardAvoidingView
- Friendly, clean, minimal UI