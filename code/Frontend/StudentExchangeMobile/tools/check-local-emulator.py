#!/usr/bin/env python3
"""UI smoke test. Requires the debug APK and mock adapter on port 3100.
Only emulator-5554 is used. Creates one in-memory mock listing/conversation.
"""
import subprocess
import time
import re
import xml.etree.ElementTree as ET
ADB = '/Users/robertrichardson/Library/Android/sdk/platform-tools/adb'
PACKAGE = 'com.studentexchange.mobile'
def adb(*args):
    return subprocess.check_output([ADB, '-s', 'emulator-5554', *args], text=True, timeout=20)
def ui():
    for attempt in range(5):
        output=adb('shell', 'uiautomator', 'dump', '/sdcard/studentexchange-ui.xml')
        if 'dumped to' in output:
            return ET.fromstring(adb('shell', 'cat', '/sdcard/studentexchange-ui.xml'))
        time.sleep(.4)
    raise AssertionError('Emulator accessibility hierarchy unavailable')
def matches(label):
    return [n for n in ui().iter('node') if n.get('text', '').casefold() == label.casefold() or n.get('content-desc', '').casefold() == label.casefold()]
def swipe(up=True):
    adb('shell', 'input', 'swipe', '500', '1600' if up else '500', '500', '500' if up else '1600', '250')
def click(node):
    x1,y1,x2,y2=map(int,re.findall(r'\d+',node.get('bounds')))
    assert x2>x1 and y2>y1, node.attrib
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
def tap(label, scroll=False):
    for attempt in range(9 if scroll else 4):
        nodes=matches(label)
        if nodes:
            click(nodes[0]);return
        if scroll:
            swipe(attempt<4)
        else:
            time.sleep(.3)
    raise AssertionError('Missing control: '+label)
def check(label):
    for attempt in range(5):
        if matches(label):break
        time.sleep(.4)
    else:raise AssertionError('Missing text: '+label+'; visible: '+repr([n.get('text') for n in ui().iter('node') if n.get('text')]))
    print('PASS:',label,flush=True)
def enter(index,value):
    fields=[n for n in ui().iter('node') if n.get('class')=='android.widget.EditText']
    click(fields[index]);adb('shell','input','text',value.replace(' ','%s'));adb('shell','input','keyevent','111')
adb('shell','am','force-stop',PACKAGE)
adb('shell','am','start','-n',PACKAGE+'/.MainActivity')
time.sleep(.5)
if matches('Skip →'):tap('Skip →')
tap('Explore');tap('Electronics')
check('No finds yet. Try another search or save a listing with the heart button.')
tap('Textbooks');tap('Mock calculus textbook')
check('Seller: Mock Seller');tap('← Campus finds')
tap('Account');tap('Log in',scroll=True);tap('Fill mock buyer',scroll=True);tap('Log in →',scroll=True)
tap('Account');check('Demo Buyer')
tap('Post');check('Pass it on.');enter(0,'Emulator smoke listing');enter(1,'12')
tap('Publish listing',scroll=True);tap('OK');check('Your corner of campus')
tap('Explore');tap('Mock calculus textbook');tap('Message seller / make offer',scroll=True)
enter(0,'Hello from emulator');tap('Send');check('Conversation');check('Hello from emulator')
tap('← Inbox');check('Your campus conversations')
tap('Account');tap('Edit profile',scroll=True);check('Your profile');tap('← Account')
tap('Log out',scroll=True);check('Join the exchange to pass things on and connect with your campus.')
print('PASS: Marketplace, login, posting, messaging, profile navigation, logout',flush=True)
