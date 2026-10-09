#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static HWND mainWindow;static BOOL CALLBACK find(HWND h,LPARAM p){char c[128];GetClassNameA(h,c,128);if(!strcmp(c,"HumMod"))mainWindow=h;return TRUE;}
int main(int argc,char**argv){EnumWindows(find,0);if(!mainWindow||argc<3)return 2;int id=atoi(argv[2]);HWND h=GetDlgItem(mainWindow,id);if(!h)return 3;if(!strcmp(argv[1],"scroll")&&argc==4){SCROLLINFO si={sizeof(si),SIF_ALL};GetScrollInfo(h,SB_CTL,&si);printf("BEFORE id=%d min=%d max=%d pos=%d\n",id,si.nMin,si.nMax,si.nPos);int v=atoi(argv[3]);if(v<si.nMin||v>si.nMax)return 4;SetScrollPos(h,SB_CTL,v,TRUE);SendMessageA(mainWindow,WM_HSCROLL,MAKEWPARAM(SB_THUMBPOSITION,v),(LPARAM)h);SendMessageA(mainWindow,WM_HSCROLL,MAKEWPARAM(SB_ENDSCROLL,0),(LPARAM)h);GetScrollInfo(h,SB_CTL,&si);printf("AFTER id=%d pos=%d\n",id,si.nPos);}else if(!strcmp(argv[1],"click")){SendMessageA(h,BM_CLICK,0,0);printf("CLICK id=%d check=%ld\n",id,(long)SendMessageA(h,BM_GETCHECK,0,0));}else return 5;return 0;}
