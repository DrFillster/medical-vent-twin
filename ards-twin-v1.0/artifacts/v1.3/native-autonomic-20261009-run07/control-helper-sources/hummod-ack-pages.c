#include <windows.h>
#include <stdio.h>
#include <string.h>
static int result=2;
static BOOL CALLBACK child(HWND h,LPARAM p){char s[1024];GetWindowTextA(h,s,sizeof(s));if(s[0]){printf("TEXT %s\n",s);if(strstr(s,"confused")||strstr(s,"talk wery")||strstr(s,"not conscious")||strstr(s,"not breathing")||strstr(s,"may be dead")||strstr(s,"patient is dead")||strstr(s,"ECG is flat"))*(int*)p=strstr(s,"ECG is flat")?2:1;}return TRUE;}
static BOOL CALLBACK win(HWND h,LPARAM p){char c[128],t[128];DWORD pid;GetWindowThreadProcessId(h,&pid);GetClassNameA(h,c,sizeof(c));GetWindowTextA(h,t,sizeof(t));if(!strcmp(c,"#32770")&&!strcmp(t,"HumMod")){int allowed=0;EnumChildWindows(h,child,(LPARAM)&allowed);char msg[1024];GetDlgItemTextA(h,65535,msg,sizeof(msg));if(allowed==2){PostMessageA(GetDlgItem(h,IDNO),BM_CLICK,0,0);puts("STOPPED at native flat ECG before autopsy");result=10;return FALSE;}if(allowed&&GetDlgItem(h,IDYES)){PostMessageA(GetDlgItem(h,IDYES),BM_CLICK,0,0);puts("ACKNOWLEDGED physiology page");result=0;}else{puts("REFUSED unknown dialog");result=3;}return FALSE;}return TRUE;}
int main(void){EnumWindows(win,0);return result;}
