export enum IPC {
  // Generic / shared
  ListAgents = 'list_agents',
  DialogOpen = '__dialog_open',
  OpenPath = 'open_path',
  HubWriteClipboardText = 'hub_write_clipboard_text',

  // Task folder lifecycle
  HubGetBootstrap = 'hub_get_bootstrap',
  HubCreateTaskFolder = 'hub_create_task_folder',
  HubPrepareTaskFolder = 'hub_prepare_task_folder',
  HubImportUploadedFiles = 'hub_import_uploaded_files',
  HubDeleteUploadedFile = 'hub_delete_uploaded_file',
  HubFindLatestNonLogFile = 'hub_find_latest_non_log_file',

  // Run orchestration (route B)
  RunDispatch = 'run_dispatch',
  RunCancel = 'run_cancel',

  // Run events (main → renderer)
  RunStarted = 'run_started',
  RunStdout = 'run_stdout',
  RunStderr = 'run_stderr',
  RunExit = 'run_exit',

  // Interactive PTY terminals (renderer → main)
  PtyOpen = 'pty_open',
  PtyInput = 'pty_input',
  PtyResize = 'pty_resize',
  PtyKill = 'pty_kill',
  PtyPrune = 'pty_prune',

  // PTY events (main → renderer)
  PtyData = 'pty_data',
  PtyExit = 'pty_exit',

  // Brain / pet coordinator (Codex-powered, independent of the terminals)
  BrainGather = 'brain_gather',
  BrainOptimize = 'brain_optimize',

  // Pet companion window
  PetSetSize = 'pet_set_size',
  PetPickImages = 'pet_pick_images',
  PetToggle = 'pet_toggle',
  PetReadImage = 'pet_read_image',
}
