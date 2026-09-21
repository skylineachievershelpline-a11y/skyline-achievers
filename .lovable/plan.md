# Skyline AI mascot and public introduction chat

## What will change
- Replace the current robot artwork with the new clean transparent robot, removing the baked background/shadow completely.
- Make one robot travel across the full width of the Skyline Achievers AI button instead of hovering in one corner; keep a subtle shadow belonging only to the robot.
- Keep the existing member AI button and make the flying robot open the same private member chat.
- Add the flying robot to the landing page; clicking it opens a single public chat that is cleared on refresh and is not saved.
- Add the supplied Skyline Achievers guide as the AI reference while excluding its fee amount because the existing rule forbids answering fee, investment, price, or earnings questions.
- Record that Skyline Achievers is led by CEO A.Q Malik. When asked who the CEO is, the public/member AI will answer and display the supplied portrait.

## Public AI boundaries
- The landing AI will explain only Skyline Achievers: its purpose, Learn • Earn • Lead philosophy, staged journey, mentorship, training, sessions, levels, dashboards, and support model.
- It will tell interested visitors that joining or taking training is only possible through an official Skyline Achievers member; they cannot enroll independently through the AI.
- It will not expose member dashboards, private training, codes, credentials, admin controls, personal data, FLP policy details, or internal configuration to public visitors.
- Fee, investment, prices, salary, earnings, and payment questions will continue to receive the senior/upline referral response with no amount or promise.

## Technical details
- Use the installed AI Elements conversation, message, prompt input, and loading components for the public chat.
- Add a public streaming AI endpoint with strict input validation, bounded message history, server-only AI credentials, and the existing `openai/gpt-6-astra` model.
- Keep private member chat persistence and access controls unchanged, while adding the Skyline guide and CEO facts to its knowledge.
- Verify the landing chat, CEO photo response, full-width robot movement, reduced-motion behavior, phone layout, and app health.
