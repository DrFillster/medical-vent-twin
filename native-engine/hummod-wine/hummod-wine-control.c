#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static HWND main_window;
static HWND dialog_window;
static HWND filename_edit;
static HWND action_button;

static BOOL CALLBACK find_main(HWND h, LPARAM unused) {
  char title[512];
  char cls[256];
  DWORD pid;
  (void)unused;

  GetWindowThreadProcessId(h, &pid);
  GetWindowTextA(h, title, sizeof title);
  GetClassNameA(h, cls, sizeof cls);

  if (!strcmp(cls, "HumMod") ||
      strstr(title, "HumMod : Integrative Biomedicine")) {
    main_window = h;
    printf("MAIN pid=%lu handle=%p class=%s title=%s\n",
           (unsigned long)pid, h, cls, title);
  }

  if (!strcmp(cls, "#32770") &&
      (!strcmp(title, "Save As") ||
       strstr(title, "Load") ||
       strstr(title, "Open"))) {
    dialog_window = h;
    printf("DIALOG pid=%lu handle=%p class=%s title=%s\n",
           (unsigned long)pid, h, cls, title);
  }

  return TRUE;
}

static BOOL CALLBACK find_dialog_controls(HWND h, LPARAM unused) {
  char cls[256];
  int id;
  (void)unused;

  GetClassNameA(h, cls, sizeof cls);
  id = GetDlgCtrlID(h);

  if (!strcmp(cls, "Edit") && (id == 1148 || id == 1001)) {
    filename_edit = h;
  }
  if (!strcmp(cls, "Button") && id == IDOK) {
    action_button = h;
  }
  return TRUE;
}

static void usage(const char *program) {
  fprintf(stderr,
    "usage: %s [main|dialog|dialog-submit <windows-path>|command <id>]\n",
    program);
}

int main(int argc, char **argv) {
  EnumWindows(find_main, 0);

  if (!main_window) {
    fprintf(stderr, "HumMod main window not found\n");
    return 2;
  }

  if (argc == 1 || !strcmp(argv[1], "main")) {
    return 0;
  }

  if (!strcmp(argv[1], "dialog")) {
    return dialog_window ? 0 : 4;
  }

  if (argc > 2 && !strcmp(argv[1], "dialog-submit")) {
    if (!dialog_window) return 4;

    EnumChildWindows(dialog_window, find_dialog_controls, 0);
    if (!filename_edit || !action_button) {
      fprintf(stderr,
              "Cannot identify filename edit/action button: edit=%p button=%p\n",
              filename_edit, action_button);
      return 5;
    }

    printf("DIALOG_SUBMIT edit=%p button=%p path=%s\n",
           filename_edit, action_button, argv[2]);
    SendMessageA(filename_edit, WM_SETTEXT, 0, (LPARAM)argv[2]);
    SendMessageA(action_button, BM_CLICK, 0, 0);
    return 0;
  }

  if (argc > 2 && !strcmp(argv[1], "command")) {
    UINT id = (UINT)strtoul(argv[2], NULL, 0);
    if (!PostMessageA(main_window, WM_COMMAND, (WPARAM)id, 0)) {
      fprintf(stderr, "WM_COMMAND failed for id=%u\n", id);
      return 6;
    }
    printf("COMMAND id=%u posted=1\n", id);
    return 0;
  }

  usage(argv[0]);
  return 1;
}
