# Start Here: SDK-Anything autonomous build

Open the SDK-Anything repository in DeepSeek Harness. Copy the pack contents into that workspace root (keep `PROMPT-PACK-README.md` separate from the product README), then paste the contents of:

`prompts/00-ORCHESTRATOR.md`

The orchestrator instructs the agent to read the approved spec, all shared rules, and each phase prompt as it becomes active. It will use the available Superpowers skills in the appropriate parts of the work, make a real plan, implement phase by phase, continuously test, commit passing slices, and push only to a safe preconfigured remote.

**Do not paste the whole prompt pack into one message.** Start with the orchestrator. The orchestrator references files so it can load context incrementally.

For an interrupted session, paste the orchestrator again and say: “Resume from `SDK_ANYTHING_AUTONOMOUS_STATE.md`; verify the last known green commit and continue from the earliest incomplete phase.”
