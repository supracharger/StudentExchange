import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, BackHandler, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Auth from './src/auth.cjs';

const C = { bg: '#F9F7F2', ink: '#202722', muted: '#626860', gold: '#F4C44E', soft: '#EFECE4', green: '#345B46', border: '#DBDDD4', white: '#FFFFFF', error: '#A22D29' };
const slides = [
  { tag: 'A LITTLE LESS SPENDING. A LOT MORE CAMPUS.', title: 'Your campus.\nYour exchange.', body: 'A place to buy, sell, and share the things that make student life happen.', chips: ['Textbooks', 'Everyday essentials', 'Campus finds'] },
  { tag: 'GOOD FINDS. CLOSE TO HOME.', title: 'Pass it on.\nPick it up.', body: 'Give your books and essentials a second semester. Discover something useful from another student.', chips: ['Buy pre-loved', 'Sell what you outgrow'] },
  { tag: 'YOUR NEXT CHAPTER STARTS HERE.', title: 'Less searching.\nMore connecting.', body: 'Find your campus community and start your next exchange, one good find at a time.', chips: ['Find your community', 'Make an exchange'] },
];
function Button({ label, onPress, secondary, disabled, busy, style }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, busy: !!busy }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, style, (pressed || disabled) && { opacity: .65 }]}>
    {busy && <ActivityIndicator color={C.ink} />}
    <Text style={[s.buttonText, secondary && { color: C.ink }]}>{label}</Text>
  </Pressable>;
}
function Link({ label, onPress, disabled }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={s.linkHit}><Text style={s.link}>{label}</Text></Pressable>;
}
function Brand({ compact = false }) {
  return <View style={s.brand}><View style={s.logo}><Text style={s.logoText}>⇄</Text></View><Text style={[s.brandText, compact && { fontSize: 17 }]}>student<Text style={{ color: C.green }}>exchange</Text></Text></View>;
}
function Artwork({ step = 0 }) {
  return <View style={s.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={s.artCircle} />
    <View style={[s.book, { backgroundColor: C.green, transform: [{ rotate: '-11deg' }], left: 32, top: 44 }]}><Text style={s.bookSmall}>NEW CHAPTER</Text><Text style={s.bookTitle}>{step === 1 ? 'Pass\nit on.' : 'Campus\nfinds.'}</Text><View style={s.bookLine} /></View>
    <View style={[s.book, { backgroundColor: C.gold, transform: [{ rotate: '9deg' }], right: 25, top: 78 }]}><Text style={[s.bookSmall, { color: C.ink }]}>SECOND SEMESTER</Text><Text style={[s.bookTitle, { color: C.ink }]}>{step === 2 ? 'Good\ncompany.' : 'Good\nas new.'}</Text><View style={[s.bookLine, { backgroundColor: C.ink }]} /></View>
    <View style={s.swap}><Text style={{ fontSize: 30, color: C.ink }}>⇄</Text></View>
    <View style={s.artCaption}><Text style={s.captionText}>More life. Less waste.</Text></View>
  </View>;
}
function Notice({ children, error }) {
  return <View style={[s.notice, error && { backgroundColor: '#FDEDEA' }]}><Text accessibilityLiveRegion="polite" style={[s.noticeText, error && { color: C.error }]}>{children}</Text></View>;
}
function Experience() {
  const [screen, setScreen] = useState('splash');
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(null);
  const passwordRef = useRef(null);
  const timer = useRef(null);
  useEffect(() => {
    const id = setTimeout(() => setScreen('welcome'), 850);
    return () => { clearTimeout(id); clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheet) { setSheet(null); return true; }
      if (busy) return true;
      if (screen === 'login') { setScreen('welcome'); return true; }
      if (screen === 'welcome' && step > 0) { setStep(step - 1); return true; }
      return false;
    });
    return () => sub.remove();
  }, [screen, step, sheet, busy]);
  function enterDemo() { setPassword(''); setErrors({}); setScreen('home'); }
  function signIn() {
    if (busy) return;
    const validation = Auth.validate(email, password);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    setBusy(true);
    timer.current = setTimeout(() => {
      const result = Auth.demoSignIn(email, password);
      setBusy(false);
      if (result.ok) enterDemo(); else setErrors(result.errors);
    }, 550);
  }
  function signOut() { setEmail(''); setPassword(''); setVisible(false); setErrors({}); setScreen('login'); }
  const slide = slides[step];
  return <SafeAreaView style={s.safe}><StatusBar style="dark" /><KeyboardAvoidingView style={s.safe} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={false}>
      <View style={s.container}>
        {screen === 'splash' && <View style={s.splash}><Brand /><Text style={s.splashTag}>Good things come around.</Text><ActivityIndicator color={C.green} style={{ marginTop: 36 }} /><Text style={s.fine}>Mobile demo</Text></View>}
        {screen === 'welcome' && <>
          <View style={s.top}><Brand compact /><Link label="Skip" onPress={() => setScreen('login')} /></View>
          <Artwork step={step} />
          <View style={s.copy}><Text style={s.eyebrow}>{slide.tag}</Text><Text accessibilityRole="header" style={s.heading}>{slide.title}</Text><Text style={s.body}>{slide.body}</Text>
            <View style={s.chips}>{slide.chips.map(x => <View key={x} style={s.chip}><Text style={s.chipText}>{x}</Text></View>)}</View>
          </View>
          <View style={s.bottom}><View style={s.dots}>{slides.map((_, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Welcome page ${i + 1} of 3`} accessibilityState={{ selected: i === step }} onPress={() => setStep(i)} style={s.dotHit}><View style={[s.dot, i === step && s.dotActive]} /></Pressable>)}</View>
            <Button label={step === 2 ? 'Get started  →' : 'Continue  →'} onPress={() => step < 2 ? setStep(step + 1) : setScreen('login')} />
            <Link label="Already here? Log in" onPress={() => setScreen('login')} />
            <Text style={s.fine}>Student Exchange · Mobile demo</Text>
          </View>
        </>}
        {screen === 'login' && <>
          <View style={s.top}><Link label="← Back" disabled={busy} onPress={() => setScreen('welcome')} /><Text style={s.demoBadge}>DEMO</Text></View>
          <View style={{ marginTop: 30 }}><Brand /></View>
          <View style={[s.copy, { marginTop: 38 }]}><Text style={s.eyebrow}>YOUR CAMPUS CONNECTION</Text><Text accessibilityRole="header" style={[s.heading, { fontSize: 38 }]}>Welcome back.</Text><Text style={s.body}>A new semester of possibilities awaits.</Text></View>
          <View style={s.form}>
            <Text style={s.label}>Email address</Text><TextInput accessibilityLabel="Email address" autoComplete="email" textContentType="emailAddress" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} editable={!busy} value={email} onChangeText={v => { setEmail(v); setErrors({}); }} placeholder="you@university.edu" placeholderTextColor={C.muted} style={[s.input, errors.email && s.inputError]} />
            {errors.email && <Text accessibilityLiveRegion="polite" style={s.error}>{errors.email}</Text>}
            <View style={s.labelRow}><Text style={s.label}>Password</Text><Link label="Forgot password?" disabled={busy} onPress={() => setSheet('reset')} /></View>
            <View style={[s.passwordRow, errors.password && s.inputError]}><TextInput ref={passwordRef} accessibilityLabel="Password" autoComplete="current-password" textContentType="password" autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={signIn} editable={!busy} secureTextEntry={!visible} value={password} onChangeText={v => { setPassword(v); setErrors({}); }} placeholder="Enter your password" placeholderTextColor={C.muted} style={s.passwordInput} /><Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} disabled={busy} onPress={() => setVisible(!visible)} style={s.visibility}><Text style={s.link}>{visible ? 'Hide' : 'Show'}</Text></Pressable></View>
            {errors.password && <Text accessibilityLiveRegion="polite" style={s.error}>{errors.password}</Text>}
            {errors.form && <Notice error>{errors.form}</Notice>}
            <Button style={{ marginTop: 22 }} label={busy ? 'Signing in…' : 'Log in  →'} disabled={busy} busy={busy} onPress={signIn} />
          </View>
          <View style={s.demoBox}><Text style={s.demoTitle}>Take it for a test drive.</Text><Text style={s.demoText}>Use a sample account. No real credentials needed.</Text><Link label="Fill demo account" disabled={busy} onPress={() => { setEmail(Auth.DEMO_EMAIL); setPassword(Auth.DEMO_PASSWORD); setErrors({}); }} /></View>
          <Button label="Explore the demo" secondary disabled={busy} onPress={enterDemo} />
          <View style={s.join}><Text style={s.body}>New to Student Exchange?</Text><Link label="Join the community" disabled={busy} onPress={() => setSheet('signup')} /></View>
          <Text style={s.fine}>Demo only · Login is not connected to the backend.</Text>
          <Link label="About this demo & privacy" onPress={() => setSheet('privacy')} />
        </>}
        {screen === 'home' && <>
          <View style={s.top}><Brand compact /><Text style={s.demoBadge}>DEMO</Text></View>
          <View style={s.successMark}><Text style={{ fontSize: 32, color: C.green }}>✓</Text></View>
          <Text style={s.eyebrow}>YOU'RE IN</Text><Text accessibilityRole="header" style={s.heading}>Hey, Alex.</Text><Text style={s.body}>Welcome to your campus exchange.</Text>
          <View style={s.homeCard}><Text style={s.homeIcon}>⇄</Text><Text style={s.cardHeading}>Your next great find.</Text><Text style={s.body}>The marketplace is our next chapter. For now, you've reached the end of the startup and login demo.</Text></View>
          <Notice>This is a sample session. No account was created and no backend request was sent.</Notice>
          <Button label="Log out" secondary onPress={signOut} />
          <Link label="Replay welcome screens" onPress={() => { signOut(); setStep(0); setScreen('welcome'); }} />
        </>}
      </View>
    </ScrollView>
    <Modal visible={sheet !== null} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
      <View style={s.overlay}><View accessibilityViewIsModal style={s.sheet}><Text accessibilityRole="header" style={s.cardHeading}>{sheet === 'reset' ? 'Need a fresh start?' : sheet === 'signup' ? 'Your community is waiting.' : 'A demo made for exploring.'}</Text><Text style={s.body}>{sheet === 'reset' ? 'Password recovery will connect to the verified backend in a later version. This demo cannot reset a password or send an email. Use the sample account to try the login flow.' : sheet === 'signup' ? 'Account creation and campus selection are planned for the next step. For now, explore with the sample account; no real account will be created.' : 'This demo makes no network requests and stores no credentials. All state stays in memory and resets when the app closes. The sample account is public and does not grant access to the existing website.'}</Text><Button style={{ marginTop: 24 }} label="Got it" onPress={() => setSheet(null)} /></View></View>
    </Modal>
  </KeyboardAvoidingView></SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><Experience /></SafeAreaProvider>; }
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, scroll: { flexGrow: 1 }, container: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 26, paddingTop: 12, paddingBottom: 24 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }, brand: { flexDirection: 'row', alignItems: 'center', gap: 9 }, logo: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }, logoText: { fontSize: 28, color: C.ink, fontWeight: '600' }, brandText: { fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: -.6 },
  splash: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 550 }, splashTag: { color: C.muted, marginTop: 18 },
  art: { height: 266, marginVertical: 22, position: 'relative' }, artCircle: { position: 'absolute', width: 228, height: 228, borderRadius: 114, backgroundColor: '#EEEADF', alignSelf: 'center', top: 6 }, book: { width: 144, height: 176, borderRadius: 12, padding: 17, position: 'absolute', borderLeftWidth: 5, borderLeftColor: '#00000018' }, bookSmall: { color: '#E8F0E9', fontSize: 9, fontWeight: '700', letterSpacing: 1 }, bookTitle: { fontSize: 25, fontWeight: '700', color: C.white, marginTop: 20, letterSpacing: -.7 }, bookLine: { width: 34, height: 3, backgroundColor: C.white, marginTop: 16 }, swap: { width: 54, height: 54, borderRadius: 27, backgroundColor: C.white, position: 'absolute', right: 16, top: 36, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '10deg' }] }, artCaption: { position: 'absolute', bottom: 0, alignSelf: 'center', borderRadius: 22, backgroundColor: C.white, paddingHorizontal: 17, paddingVertical: 10 }, captionText: { color: C.green, fontSize: 12, fontWeight: '600' },
  copy: { marginTop: 12 }, eyebrow: { color: C.green, fontSize: 10, fontWeight: '700', letterSpacing: 1.4, lineHeight: 17, marginBottom: 12 }, heading: { fontSize: 42, lineHeight: 47, fontWeight: '700', letterSpacing: -1.8, color: C.ink, marginBottom: 14 }, body: { color: C.muted, fontSize: 15, lineHeight: 23 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 22 }, chip: { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.soft, borderRadius: 18 }, chipText: { fontSize: 11, color: C.ink },
  bottom: { marginTop: 'auto', paddingTop: 10 }, dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 6 }, dotHit: { paddingHorizontal: 5, height: 44, justifyContent: 'center' }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#CCCFC5' }, dotActive: { width: 24, backgroundColor: C.green }, button: { minHeight: 54, paddingVertical: 15, paddingHorizontal: 18, borderRadius: 16, backgroundColor: C.gold, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10 }, secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border }, buttonText: { fontSize: 16, fontWeight: '700', color: C.ink }, linkHit: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }, link: { fontSize: 13, fontWeight: '600', color: C.green }, fine: { color: C.muted, fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 12 }, demoBadge: { color: C.green, fontSize: 10, fontWeight: '700', letterSpacing: 1, backgroundColor: '#E5EDE3', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14 },
  form: { marginTop: 28 }, label: { color: C.ink, fontSize: 13, fontWeight: '600', marginBottom: 9 }, input: { borderWidth: 1, borderColor: C.border, backgroundColor: C.white, minHeight: 54, borderRadius: 13, paddingHorizontal: 16, fontSize: 16, color: C.ink }, labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }, passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, borderRadius: 13, backgroundColor: C.white, minHeight: 54 }, passwordInput: { flex: 1, minHeight: 54, fontSize: 16, paddingHorizontal: 16, color: C.ink }, visibility: { minHeight: 48, minWidth: 58, justifyContent: 'center', alignItems: 'center' }, inputError: { borderColor: C.error }, error: { color: C.error, fontSize: 12, marginTop: 7, lineHeight: 19 },
  demoBox: { backgroundColor: C.soft, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, borderRadius: 16, marginVertical: 20 }, demoTitle: { fontSize: 14, color: C.ink, fontWeight: '600' }, demoText: { fontSize: 12, color: C.muted, lineHeight: 19, marginTop: 5 }, join: { alignItems: 'center', marginTop: 24 }, notice: { backgroundColor: '#E8EEE5', padding: 14, borderRadius: 13, marginVertical: 16 }, noticeText: { color: C.green, fontSize: 12, lineHeight: 20 },
  successMark: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E3ECDF', alignItems: 'center', justifyContent: 'center', marginTop: 65, marginBottom: 24 }, homeCard: { backgroundColor: C.white, padding: 24, borderRadius: 24, marginTop: 28 }, homeIcon: { color: C.green, fontSize: 40, marginBottom: 18 }, cardHeading: { fontSize: 24, fontWeight: '700', color: C.ink, letterSpacing: -.7, marginBottom: 14 }, overlay: { flex: 1, backgroundColor: '#20272277', justifyContent: 'center', alignItems: 'center', padding: 24 }, sheet: { padding: 26, borderRadius: 24, backgroundColor: C.bg, width: '100%', maxWidth: 420 },
});
