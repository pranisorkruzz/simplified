# Project Context

## App Name
[Your App Name]

## What This App Does
Task management app where users input a task → AI asks 5 
follow up questions according to the inputted task to get more context  → generates a visual flowchart showing 
task breakdown → each node is tappable and opens a bottom 
sheet with a Kansan style and chatbot for that subtask → user can mark 
subtasks as done.

## Tech Stack
- React Native + Expo
- Supabase (auth + database + edge functions)
- TypeScript
- Gemini 2.5 Flash API (validation + follow up questions)
- Gemini 2.5 Pro (flowchart generation)
- AsyncStorage (local data persistence)

## App Flow
1. User inputs task in Briefs tab
2. AI validates if input is a real task
3. AI asks 5 follow up questions one by one
4. AI generates flowchart as JSON
5. Flowchart renders visually with nodes and arrows
6. User taps node → bottom sheet opens with chatbot
7. User marks node as done → turns green → saves to Supabase


## Design Rules
- Match existing font and color scheme throughout
- No italic fonts anywhere in the app
- Friendly, clean minimal UI
- Works on both iOS and Android
- All screens use KeyboardAvoidingView

## Coding Rules
- Always match existing font and color scheme
- Never break existing functionality
- Use TypeScript strictly
- Save all user data to Supabase
- Handle all errors with user friendly messages
- Always use AsyncStorage for local persistence
- Never add new dependencies without asking first
- Never change navigation structure

## Known Issues Fixed
- Personal info screen now saves with AsyncStorage
- Keyboard dismiss fixed across all screens
- Task validation blocks gibberish/greetings
- Profile saves using upsert not update
