import subprocess,time,json,pathlib,os
root=pathlib.Path('/Users/philipbernard/.hermes/cache/scratch/vent-v13-fidelity-build/ards-twin-v1.0/artifacts/v1.3/native-autonomic-20261009-run07')
log=root/'advance-attempts.jsonl'
# First advance independently verified by native-step001.SOLN.
def click(x,y):
    r=subprocess.run(['cua-driver','call','click',json.dumps({'scope':'desktop','x':x,'y':y})],capture_output=True,text=True,timeout=15)
    if r.returncode: raise RuntimeError(r.stdout+r.stderr)
# native-step139.SOLN verifies 139 completed advances. Flat ECG notice declined at advance138; advancing again works without autopsy/model edits.
for step in range(140,181):
    time.sleep(0.250)
    started=time.monotonic()
    click(125,71)
    click(145,87)
    with log.open('a') as f:f.write(json.dumps({'advanceAttempt':step,'delayBeforeSeconds':0.250,'elapsedSeconds':time.monotonic()-started,'method':'native Go > 1 Sec desktop clicks'})+'\n')
    ack=subprocess.run([os.environ['WINE_BIN'],'/Users/philipbernard/.hermes/cache/scratch/hummod-ack-pages.exe'],capture_output=True,text=True,timeout=15)
    if ack.returncode not in (0,2):
        print('Native stop at advance',step,'code',ack.returncode,ack.stdout,ack.stderr,flush=True)
        break
    if ack.returncode==0: print('Native physiology notice:',ack.stdout,flush=True)
    if step%10==0:
        print('Submitted advance',step,flush=True)
        subprocess.run(['cua-driver','call','get_desktop_state','{}','--screenshot-out-file',str(root/f'advance-{step:03}.png')],capture_output=True,timeout=15,check=True)
print('Final submitted advance index:',step,'; native export required to verify completed simulation time',flush=True)
