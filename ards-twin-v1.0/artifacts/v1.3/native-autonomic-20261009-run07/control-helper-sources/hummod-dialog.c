#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdio.h>
#include <string.h>

static HWND main_window, load_dialog, filename_edit, action_button;
static DWORD main_pid;
static unsigned main_count, load_count;

static BOOL CALLBACK find_main(HWND h, LPARAM unused) {
  char title[256] = {0}, cls[256] = {0}; DWORD pid=0; (void)unused;
  GetWindowThreadProcessId(h,&pid); GetWindowTextA(h,title,sizeof title); GetClassNameA(h,cls,sizeof cls);
  if (!strcmp(cls,"HumMod") || strstr(title,"HumMod : Integrative Biomedicine")) {
    main_window=h; main_pid=pid; main_count++;
  }
  return TRUE;
}

static BOOL CALLBACK find_load(HWND h, LPARAM unused) {
  char title[256]={0}, cls[256]={0}; DWORD pid=0; (void)unused;
  GetWindowThreadProcessId(h,&pid); GetWindowTextA(h,title,sizeof title); GetClassNameA(h,cls,sizeof cls);
  CharLowerBuffA(title,(DWORD)strlen(title));
  if (pid==main_pid && IsWindowVisible(h) && !strcmp(cls,"#32770") &&
      (strstr(title,"load") || strstr(title,"open") || strstr(title,"save"))) {
    load_dialog=h; load_count++;
  }
  return TRUE;
}

static BOOL CALLBACK find_controls(HWND h, LPARAM unused) {
  char cls[256]={0}; (void)unused; GetClassNameA(h,cls,sizeof cls);
  if (!strcmp(cls,"Edit") && GetDlgCtrlID(h)==1148) filename_edit=h;
  if (!strcmp(cls,"Button") && GetDlgCtrlID(h)==IDOK) action_button=h;
  return TRUE;
}

int main(int argc, char **argv) {
  if (argc!=3 || strcmp(argv[1],"load-solution")) {
    fprintf(stderr,"usage: %s load-solution <absolute-windows-path>\n",argv[0]); return 1;
  }
  const char *path=argv[2];
  if (strlen(path)<4 || path[1]!=':' || (path[2]!='\\' && path[2]!='/') || strchr(path,'\"')) {
    fprintf(stderr,"Load requires an absolute Windows path\n"); return 6;
  }
  EnumWindows(find_main,0);
  if (!main_window || main_count!=1) { fprintf(stderr,"Need exactly one HumMod main window\n"); return 2; }
  EnumWindows(find_load,0);
  if (load_count!=1) { fprintf(stderr,"Open File > Load Solution in HumMod, leave the dialog open, then retry\n"); return 7; }
  EnumChildWindows(load_dialog,find_controls,0);
  if (!filename_edit || !action_button) { fprintf(stderr,"Cannot identify filename/Open controls\n"); return 5; }
  DWORD_PTR result=0;
  if (!SendMessageTimeoutA(filename_edit,WM_SETTEXT,0,(LPARAM)path,SMTO_ABORTIFHUNG,3000,&result) || !result) return 10;
  if (!PostMessageA(action_button,BM_CLICK,0,0)) return 11;
  printf("LOAD_SUBMITTED pid=%lu path=%s\n",(unsigned long)main_pid,path);
  return 0;
}
