package com.studentexchange.mobile;

import android.app.*;
import android.os.Bundle;
import android.content.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.text.*;
import android.text.method.PasswordTransformationMethod;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.util.*;
import com.studentexchange.mobile.api.ApiClient;
import com.studentexchange.mobile.api.MarketplaceApi;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/** Native StudentExchange UI connected through the isolated development adapter. */
public class MainActivity extends Activity {
 final int GREEN=Color.rgb(42,141,119), INK=Color.rgb(25,46,42), MUTED=Color.rgb(105,120,114), BG=Color.rgb(246,249,247), LINE=Color.rgb(221,230,224);
 String[] categories={"All finds"};
 final ArrayList<String> conditions=new ArrayList<>();
 String conditionFilter="All conditions";
 MarketplaceApi api;
 static MarketplaceApi.Profile signedProfile;
 String apiError="The request could not be completed. Check the adapter and retry.";
 long conversationId=0;
 final ArrayList<MarketplaceApi.Message> threadMessages=new ArrayList<>();
 final Set<okhttp3.ResponseBody> imageBodies=Collections.synchronizedSet(new HashSet<>());
 final java.util.concurrent.ExecutorService imageWorker=java.util.concurrent.Executors.newSingleThreadExecutor();

 final android.os.Handler networkHandler=new android.os.Handler(android.os.Looper.getMainLooper());
 final ArrayList<Call<?>> activeCalls=new ArrayList<>();
 Call<List<MarketplaceApi.Listing>> listingCall;
 Runnable pendingSearch;
 boolean loadingListings=false,loadingDirectories=false,directoriesReady=false;
 String listingError="",directoryError="";
 int listingGeneration=0;
 LinearLayout categoryChips;
 android.content.SharedPreferences prefs;
 LinearLayout root,body,grid; String activeItem=""; String tab="Explore",category="All finds",query="",session="",photo="",screen=""; boolean usedOnly=false; double maxPrice=10000;
 ArrayList<Item> items=new ArrayList<>(); Set<String> saved=new HashSet<>();
 static class Item {String id,title,category,description,campus,image,owner; String condition="",seller="",status="",isbn=""; ArrayList<String> images=new ArrayList<>(); double price; boolean used=true;
 Item(JSONObject j){id=j.optString("id");title=j.optString("title");category=j.optString("category");description=j.optString("description");campus=j.optString("campus");image=j.optString("image");owner=j.optString("owner");price=j.optDouble("price");used=j.optBoolean("used",true);}
 }
 @Override public void onCreate(Bundle state){super.onCreate(state);api=ApiClient.create();prefs=getSharedPreferences("studentexchange",MODE_PRIVATE);session=signedProfile==null?"":signedProfile.email;saved=new HashSet<>(prefs.getStringSet("saved",new HashSet<>()));if(state!=null){
 tab=state.getString("tab","Explore");category=state.getString("category","All finds");query=state.getString("query","");photo=state.getString("photo","");usedOnly=state.getBoolean("usedOnly");maxPrice=state.getDouble("maxPrice",10000);activeItem=state.getString("item","");conditionFilter=state.getString("conditionFilter","All conditions");
 String page=state.getString("screen","home");
 if(page.equals("onboarding"))onboarding();else if(page.equals("login")||page.equals("register"))auth(page.equals("register"));else if(page.equals("thread")){thread(state.getLong("conversationId"),false);}else if(page.equals("detail")){Item match=null;for(Item i:items)if(i.id.equals(activeItem))match=i;if(match!=null)detail(match);else if(activeItem.matches("[1-9][0-9]*")){try{detail(new Item(new JSONObject().put("id",activeItem)));}catch(JSONException ignored){home(tab);}}else home(tab);}else home(tab);
 ArrayList<String> values=state.getStringArrayList("fields");if(values!=null){ArrayList<EditText> fields=new ArrayList<>();collectFields(root,fields);for(int i=0;i<Math.min(fields.size(),values.size());i++)fields.get(i).setText(values.get(i));}
 }else if(prefs.getBoolean("onboarded",false))home("Explore");else onboarding();}
 int d(float n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
 GradientDrawable shape(int color,int radius){GradientDrawable g=new GradientDrawable();g.setColor(color);g.setCornerRadius(d(radius));g.setStroke(d(1),color==Color.WHITE?LINE:color);return g;}
 LinearLayout col(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
 LinearLayout row(){LinearLayout l=new LinearLayout(this);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
 void pad(View v,int n){v.setPadding(d(n),d(n),d(n),d(n));}
 void gap(LinearLayout l,int n){View v=new View(this);l.addView(v,new LinearLayout.LayoutParams(1,d(n)));}
 TextView text(String s,int size,boolean bold){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(INK);if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;}
 void label(LinearLayout l,String s,int size,boolean bold){l.addView(text(s,size,bold));}
 void copy(LinearLayout l,String s){TextView t=text(s,16,false);t.setTextColor(MUTED);t.setLineSpacing(d(5),1);l.addView(t);}
 Button button(String s,boolean primary,Runnable r){Button b=new Button(this);b.setText(s);b.setAllCaps(false);b.setTextSize(16);b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);b.setTextColor(primary?Color.WHITE:GREEN);b.setBackground(shape(primary?GREEN:Color.WHITE,16));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,d(54));p.topMargin=d(12);b.setLayoutParams(p);b.setOnClickListener(v->r.run());return b;}
 void action(LinearLayout l,String s,boolean primary,Runnable r){l.addView(button(s,primary,r));}
 EditText field(LinearLayout l,String title,String hint,boolean password){gap(l,18);label(l,title,14,true);gap(l,8);EditText e=new EditText(this);e.setSingleLine(true);e.setTextSize(16);e.setTextColor(INK);e.setHint(hint);e.setHintTextColor(MUTED);pad(e,14);e.setBackground(shape(Color.WHITE,14));e.setInputType(password?129:1);l.addView(e,new LinearLayout.LayoutParams(-1,d(54)));return e;}
 void base(String name){listingGeneration++;if(listingCall!=null)listingCall.cancel();if(pendingSearch!=null)networkHandler.removeCallbacks(pendingSearch);screen=name;root=col();root.setBackgroundColor(BG);setContentView(root);}
 LinearLayout scroll(){ScrollView s=new ScrollView(this);s.setFillViewport(true);body=col();pad(body,22);s.addView(body);root.addView(s,new LinearLayout.LayoutParams(-1,0,1));return body;}
 void brand(LinearLayout l){ImageView v=new ImageView(this);v.setImageResource(R.drawable.brand);v.setScaleType(ImageView.ScaleType.FIT_START);v.setContentDescription("StudentExchange");l.addView(v,new LinearLayout.LayoutParams(-1,d(43)));}
 void image(LinearLayout l,String source,int height){ImageView v=new ImageView(this);setImage(v,source);v.setScaleType(ImageView.ScaleType.FIT_CENTER);v.setBackground(shape(Color.rgb(237,233,243),18));v.setClipToOutline(true);l.addView(v,new LinearLayout.LayoutParams(-1,d(height)));}
 void setImage(ImageView v,String source){if(source!=null&&source.startsWith("/uploads/")){remoteImage(v,source);return;}if(source==null)source="books";if(source.equals("headphones"))v.setImageResource(R.drawable.headphones);else if(source.equals("calculus"))v.setImageResource(R.drawable.calculus);else if(source.equals("books"))v.setImageResource(R.drawable.onboarding_books);else {try{
 android.graphics.BitmapFactory.Options o=new android.graphics.BitmapFactory.Options();o.inJustDecodeBounds=true;
 try(java.io.InputStream in=getContentResolver().openInputStream(Uri.parse(source))){android.graphics.BitmapFactory.decodeStream(in,null,o);}
 o.inSampleSize=1;while(o.outWidth/o.inSampleSize>1200||o.outHeight/o.inSampleSize>1200)o.inSampleSize*=2;o.inJustDecodeBounds=false;
 try(java.io.InputStream in=getContentResolver().openInputStream(Uri.parse(source))){v.setImageBitmap(android.graphics.BitmapFactory.decodeStream(in,null,o));}
 if(v.getDrawable()==null)v.setImageResource(R.drawable.onboarding_books);
 }catch(Exception e){v.setImageResource(R.drawable.onboarding_books);}}}
 void remoteImage(ImageView view,String path){view.setImageResource(R.drawable.onboarding_books);if(!path.matches("/uploads/[A-Za-z0-9_-]+\\.(png|jpg|jpeg|webp)"))return;view.setTag(path);request(api.image(path.substring(9)),body->{if(imageWorker.isShutdown()){body.close();return;}imageBodies.add(body);imageWorker.execute(()->{try(okhttp3.ResponseBody image=body){if(image.contentLength()>2*1024*1024)return;java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream();java.io.InputStream stream=image.byteStream();byte[] buffer=new byte[8192];int count;while((count=stream.read(buffer))!=-1){if(output.size()+count>2*1024*1024)return;output.write(buffer,0,count);}byte[] bytes=output.toByteArray();if(bytes.length>2*1024*1024)return;android.graphics.BitmapFactory.Options o=new android.graphics.BitmapFactory.Options();o.inJustDecodeBounds=true;android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.length,o);o.inSampleSize=1;while(o.outWidth/o.inSampleSize>1200||o.outHeight/o.inSampleSize>1200)o.inSampleSize*=2;o.inJustDecodeBounds=false;android.graphics.Bitmap bitmap=android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.length,o);if(bitmap!=null)runOnUiThread(()->{if(!isDestroyed()&&path.equals(view.getTag()))view.setImageBitmap(bitmap);});}catch(Exception ignored){}finally{imageBodies.remove(body);}});},()->{});}
 void onboarding(){base("onboarding");LinearLayout l=scroll();brand(l);action(l,"Skip →",false,()->{prefs.edit().putBoolean("onboarded",true).apply();home("Explore");});gap(l,20);image(l,"books",265);gap(l,26);TextView over=text("MADE FOR YOUR NEXT CHAPTER",13,true);over.setTextColor(GREEN);l.addView(over);gap(l,10);label(l,"Your campus.\nYour exchange.",38,true);gap(l,18);copy(l,"A little less spending. A little more student life. Find a new home for the things you love.");gap(l,20);action(l,"Continue →",true,()->{prefs.edit().putBoolean("onboarded",true).apply();auth(true);});action(l,"Already here? Log in",false,()->auth(false));gap(l,12);copy(l,BuildConfig.LOCAL_MOCK?"Development preview · Local mock marketplace":"Connected adapter preview");}
 void auth(boolean register){base(register?"register":"login");LinearLayout page=root,l=scroll();action(l,"← Back to marketplace",false,()->home("Explore"));gap(l,25);brand(l);gap(l,30);label(l,register?"Your next chapter.":"Welcome back.",36,true);copy(l,register?"Create your campus account.":"Your next great find is just around the corner.");
 EditText first=register?field(l,"First name","First name",false):null,last=register?field(l,"Last name","Last name",false):null;
 EditText email=field(l,"Email address","you@university.edu",false);email.setInputType(33);
 EditText password=field(l,"Password",register?"8–50 characters, uppercase and symbol":"Enter your password",true);
 action(l,"Show / hide password",false,()->{password.setTransformationMethod(password.getTransformationMethod()==null?PasswordTransformationMethod.getInstance():null);password.setSelection(password.length());});
 Spinner school=register?new Spinner(this):null;
 if(register){label(l,"School",14,true);l.addView(school);school.setEnabled(false);request(api.schools(),data->{if(root!=page)return;if(data.schools==null||data.schools.isEmpty()){info("Schools unavailable","Retry registration when the school list is available.");return;}school.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,data.schools));school.setEnabled(true);},()->{if(root==page)info("Schools unavailable",apiError);});}
 final boolean[] busy={false};
 action(l,register?"Create account →":"Log in →",true,()->{
  if(busy[0])return;
  String mail=email.getText().toString().trim().toLowerCase(Locale.ROOT),pw=password.getText().toString();
  if(!android.util.Patterns.EMAIL_ADDRESS.matcher(mail).matches()){email.setError("Enter a valid email address");return;}
  if(pw.isEmpty()){password.setError("Enter your password");return;}
  Map<String,Object> fields=new HashMap<>();fields.put("email",mail);fields.put("password",pw);
  if(register){if(first.length()==0||last.length()==0||!school.isEnabled()){info("Complete your profile","Enter your first and last names and choose a school.");return;}fields.put("first_name",first.getText().toString().trim());fields.put("last_name",last.getText().toString().trim());fields.put("school",school.getSelectedItem().toString());}
  busy[0]=true;
  request(register?api.register(fields):api.login(fields),result->{busy[0]=false;if(root!=page)return;password.setText("");if(register){auth(false);info("Account created","You can now log in.");}else{if(result.profile==null)throw new IllegalArgumentException();signedProfile=result.profile;session=signedProfile.email;home("Explore");}},()->{busy[0]=false;if(root==page)info(register?"Could not create account":"Could not log in",apiError);});
 });
 if(!register){action(l,"Forgot password?",false,()->info("Account recovery","The backend has no password recovery endpoint. Contact the project team."));if(BuildConfig.LOCAL_MOCK){action(l,"Fill mock buyer",false,()->{email.setText("demo@mock.invalid");password.setText("CampusDemo123!");});action(l,"Fill mock seller",false,()->{email.setText("seller@mock.invalid");password.setText("CampusDemo123!");});}}
 action(l,register?"Already here? Log in":"New here? Create account",false,()->auth(!register));action(l,"Explore without logging in →",false,()->home("Explore"));copy(l,BuildConfig.LOCAL_MOCK?"Local mock mode · use sample credentials. Restarting the app process or adapter ends the session.":"Connected adapter · restarting the app process or adapter requires login.");}
 class NavIcon extends View {
 final int index,tint; NavIcon(int index,int tint){super(MainActivity.this);this.index=index;this.tint=tint;setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}
 @Override protected void onDraw(android.graphics.Canvas c){super.onDraw(c);c.save();c.scale(getWidth()/24f,getHeight()/24f);android.graphics.Paint p=new android.graphics.Paint(3);p.setColor(tint);p.setStyle(android.graphics.Paint.Style.STROKE);p.setStrokeWidth(1.7f);p.setStrokeCap(android.graphics.Paint.Cap.ROUND);p.setStrokeJoin(android.graphics.Paint.Join.ROUND);android.graphics.Path path=new android.graphics.Path();
 if(index==0){path.moveTo(3,10);path.lineTo(12,3);path.lineTo(21,10);path.lineTo(21,21);path.lineTo(15,21);path.lineTo(15,14);path.lineTo(9,14);path.lineTo(9,21);path.lineTo(3,21);path.close();c.drawPath(path,p);}
 else if(index==1){path.moveTo(12,21);path.cubicTo(9,18,2,13,2,8);path.cubicTo(2,2,9,1,12,6);path.cubicTo(15,1,22,2,22,8);path.cubicTo(22,13,15,18,12,21);c.drawPath(path,p);}
 else if(index==2){c.drawLine(12,4,12,20,p);c.drawLine(4,12,20,12,p);}
 else if(index==3){path.moveTo(4,20);path.lineTo(5,15);path.cubicTo(-2,3,20,-1,21,9);path.cubicTo(23,17,12,21,7,18);path.close();c.drawPath(path,p);}
 else{c.drawCircle(12,7,4,p);path.moveTo(4,22);path.cubicTo(3,10,21,10,20,22);c.drawPath(path,p);}c.restore();}
 }
 void header(){LinearLayout h=row();pad(h,16);ImageView logo=new ImageView(this);logo.setImageResource(R.drawable.brand);logo.setScaleType(ImageView.ScaleType.FIT_START);logo.setContentDescription("StudentExchange");h.addView(logo,new LinearLayout.LayoutParams(0,d(36),1));TextView info=text(" ⓘ ",24,false);info.setContentDescription("About StudentExchange");info.setOnClickListener(v->info("StudentExchange",BuildConfig.LOCAL_MOCK?"Good finds. Better together.\n\nLocal mock marketplace. Saved items stay on this device.":"Good finds. Better together.\n\nListings, accounts and conversations use the configured adapter. Saved items stay on this device."));h.addView(info);root.addView(h);}
 void home(String selected){tab=selected;base("home");header();LinearLayout l=scroll();if(selected.equals("Explore")||selected.equals("Saved"))market(l,selected.equals("Saved"));else if(selected.equals("Post"))post(l);else if(selected.equals("Inbox"))inbox(l);else account(l);LinearLayout nav=row();nav.setBackgroundColor(Color.WHITE);String[] icons={"⌂","♡","＋","☏","○"};String[] names={"Explore","Saved","Post","Inbox","Account"};for(int i=0;i<names.length;i++){String n=names[i];LinearLayout b=col();b.setGravity(Gravity.CENTER);int tint=n.equals(tab)?GREEN:MUTED;NavIcon icon=new NavIcon(i,tint);b.addView(icon,new LinearLayout.LayoutParams(d(27),d(27)));TextView caption=text(n,11,n.equals(tab));caption.setTextColor(tint);b.addView(caption);b.setContentDescription(n);b.setOnClickListener(v->home(n));nav.addView(b,new LinearLayout.LayoutParams(0,d(64),1));}root.addView(nav);}
 void market(LinearLayout l,boolean onlySaved){if(!onlySaved){LinearLayout hero=row();pad(hero,18);hero.setBackground(shape(Color.rgb(232,243,236),22));LinearLayout words=col();label(words,"Good finds.\nBetter together.",27,true);gap(words,12);copy(words,"Buy less new.\nMake room for more.");hero.addView(words,new LinearLayout.LayoutParams(0,-2,1));ImageView art=new ImageView(this);art.setImageResource(R.drawable.onboarding_books);art.setScaleType(ImageView.ScaleType.FIT_CENTER);hero.addView(art,new LinearLayout.LayoutParams(d(95),d(150)));l.addView(hero);gap(l,16);}
 EditText search=field(l,"Search campus finds","What are you looking for?",false);search.setText(query);action(l,"Filters",false,()->filters());HorizontalScrollView hs=new HorizontalScrollView(this);hs.setHorizontalScrollBarEnabled(false);LinearLayout chips=row();categoryChips=chips;renderCategories();hs.addView(chips);l.addView(hs);label(l,onlySaved?"Saved finds":"Fresh on campus",24,true);gap(l,16);grid=col();l.addView(grid);renderGrid(onlySaved);search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int start,int count,int after){}public void onTextChanged(CharSequence s,int start,int before,int count){query=s.toString();if(pendingSearch!=null)networkHandler.removeCallbacks(pendingSearch);listingGeneration++;if(listingCall!=null)listingCall.cancel();loadingListings=true;renderGrid(onlySaved);pendingSearch=()->fetchListings();networkHandler.postDelayed(pendingSearch,350);}public void afterTextChanged(Editable e){}});fetchListings();loadDirectories();}
 void renderGrid(boolean onlySaved){grid.removeAllViews();
 if(loadingListings){grid.addView(new ProgressBar(this));copy(grid,"Loading campus finds…");return;}
 if(!listingError.isEmpty()){copy(grid,listingError);action(grid,"Retry",false,()->{fetchListings();loadDirectories();});return;}
 if(!directoryError.isEmpty()){copy(grid,directoryError);action(grid,"Retry filters",false,()->loadDirectories());}
ArrayList<Item> filtered=new ArrayList<>();for(Item i:items)if((!onlySaved||saved.contains(i.id))&&(category.equals("All finds")||category.equals(i.category))&&(!usedOnly||i.used)&&i.price<=maxPrice&&(conditionFilter.equals("All conditions")||conditionFilter.equals(i.condition)))filtered.add(i);if(filtered.isEmpty()){copy(grid,"No finds yet. Try another search or save a listing with the heart button.");return;}copy(grid,filtered.size()+" finds");gap(grid,8);for(int k=0;k<filtered.size();k+=2){LinearLayout r=row();r.setGravity(Gravity.TOP);for(int n=k;n<Math.min(k+2,filtered.size());n++){Item i=filtered.get(n);LinearLayout card=col();card.setBackground(shape(Color.WHITE,18));card.setClipToOutline(true);ImageView img=new ImageView(this);setImage(img,i.image);img.setContentDescription(i.title);img.setScaleType(ImageView.ScaleType.CENTER_CROP);FrameLayout frame=new FrameLayout(this);frame.addView(img,new FrameLayout.LayoutParams(-1,-1));if(i.id.startsWith("sample-")){TextView badge=text("SAMPLE",10,true);badge.setTextColor(MUTED);pad(badge,6);badge.setBackground(shape(Color.WHITE,10));FrameLayout.LayoutParams bp=new FrameLayout.LayoutParams(-2,-2,Gravity.TOP|Gravity.START);bp.setMargins(d(8),d(8),0,0);frame.addView(badge,bp);}card.addView(frame,new LinearLayout.LayoutParams(-1,d(152)));img.setOnClickListener(v->detail(i));LinearLayout content=col();pad(content,10);label(content,money(i.price),23,true);TextView title=text(i.title,15,true);content.addView(title);title.setOnClickListener(v->detail(i));gap(content,6);copy(content,i.campus);Button heart=button(saved.contains(i.id)?"♥ Saved":"♡ Save",false,()->{toggle(i);renderGrid(onlySaved);});heart.setContentDescription("Save "+i.title);content.addView(heart);card.addView(content);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-2,1);p.setMargins(0,0,d(8),d(14));r.addView(card,p);}if(k+1==filtered.size())r.addView(new View(this),new LinearLayout.LayoutParams(0,1,1));grid.addView(r);}}
 String money(double price){return String.format(Locale.US,price==Math.floor(price)?"$%.0f":"$%.2f",price);}
 void toggle(Item i){if(!saved.add(i.id))saved.remove(i.id);prefs.edit().putStringSet("saved",new HashSet<>(saved)).apply();}
 void filters(){LinearLayout l=col();pad(l,20);EditText price=field(l,"Maximum price ($)","Any price",false);price.setInputType(8194);if(maxPrice<10000)price.setText(String.valueOf(maxPrice));gap(l,16);label(l,"Condition",14,true);Spinner condition=new Spinner(this);ArrayList<String> options=new ArrayList<>();options.add("All conditions");options.addAll(conditions);condition.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,options));condition.setSelection(Math.max(0,options.indexOf(conditionFilter)));l.addView(condition);if(!directoriesReady)copy(l,"Condition choices are unavailable until filters load. Retry from the marketplace.");CheckBox used=new CheckBox(this);used.setText("Used items only");used.setChecked(usedOnly);l.addView(used);AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Find your next great thing").setView(l).setPositiveButton("Apply",null).setNeutralButton("Reset",(a,b)->{maxPrice=10000;usedOnly=false;conditionFilter="All conditions";category="All finds";query="";home(tab);}).setNegativeButton("Cancel",null).create();dialog.setOnShowListener(v->dialog.getButton(-1).setOnClickListener(w->{try{double p=price.length()==0?10000:Double.parseDouble(price.getText().toString());if(!Double.isFinite(p)||p<0)throw new NumberFormatException();maxPrice=p;usedOnly=used.isChecked();conditionFilter=options.get(condition.getSelectedItemPosition());dialog.dismiss();home(tab);}catch(Exception e){price.setError("Enter a valid positive price");}}));dialog.show();}
 void showDetail(Item i){activeItem=i.id;base("detail");LinearLayout l=scroll();action(l,"← Campus finds",false,()->home(tab));gap(l,16);label(l,"Campus find",24,true);gap(l,18);image(l,i.image,310);gap(l,20);label(l,money(i.price),34,true);gap(l,8);label(l,i.title,26,true);gap(l,14);copy(l,i.condition+"  ·  "+i.category);gap(l,10);copy(l,"Seller: "+(i.seller.isEmpty()?i.owner:i.seller));gap(l,14);copy(l,"⌖ "+i.campus);gap(l,16);copy(l,i.description);action(l,saved.contains(i.id)?"♥ Saved":"♡ Save find",false,()->{toggle(i);showDetail(i);});for(int index=1;index<i.images.size();index++)image(l,i.images.get(index),240);copy(l,"Status: "+i.status);action(l,"Message seller / make offer",true,()->{if(requireLogin())compose(i,0);});}

 boolean requireLogin(){if(signedProfile!=null&&!session.isEmpty())return true;new AlertDialog.Builder(this).setTitle("Join your campus").setMessage("Log in to post listings and send messages.").setPositiveButton("Log in",(a,b)->auth(false)).setNegativeButton("Cancel",null).show();return false;}
 void post(LinearLayout l){label(l,"Pass it on.",32,true);if(!requireLogin()){copy(l,"Log in to create a listing.");return;}loadDirectories();if(!directoriesReady){copy(l,"Load the category and condition choices before posting.");action(l,"Retry / open form",true,()->home("Post"));return;}listingFormBody(l,null);}
 Spinner choices(LinearLayout l,String label,List<String> values,String selected){label(l,label,14,true);Spinner spinner=new Spinner(this);spinner.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,values));spinner.setSelection(Math.max(0,values.indexOf(selected)));l.addView(spinner);return spinner;}
 void editListing(Item item){base("edit");LinearLayout l=scroll();action(l,"← Account",false,()->home("Account"));label(l,"Manage your find",30,true);listingFormBody(l,item);}
 void listingFormBody(LinearLayout l,Item item){
  final LinearLayout page=root;photo="";
  EditText title=field(l,"Title","What are you passing on?",false),price=field(l,"Price ($)","0.00",false);price.setInputType(8194);
  ArrayList<String> cats=new ArrayList<>(Arrays.asList(categories));cats.remove("All finds");
  if(cats.isEmpty()||conditions.isEmpty()){copy(l,"Category or condition choices unavailable. Return to Explore and retry filters.");return;}
  Spinner cat=choices(l,"Category",cats,item==null?cats.get(0):item.category),condition=choices(l,"Condition",conditions,item==null?conditions.get(0):item.condition);
  EditText isbn=field(l,"ISBN (textbooks only, optional)","ISBN",false),description=field(l,"Description","Describe your find",false);description.setSingleLine(false);description.setMinLines(3);
  if(item!=null){title.setText(item.title);price.setText(String.valueOf(item.price));description.setText(item.description);isbn.setText(item.isbn);}
  copy(l,"Pickup location comes from your profile. Add or edit it in Account.");
  ImageView preview=new ImageView(this);preview.setTag("photoPreview");l.addView(preview,new LinearLayout.LayoutParams(-1,d(170)));
  TextView photoStatus=text("Optional: add a photo (PNG, JPEG or WebP).",14,false);photoStatus.setTag("photoStatus");l.addView(photoStatus);
  action(l,"Choose photo",false,()->{Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.setType("image/*");intent.addCategory(Intent.CATEGORY_OPENABLE);intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);startActivityForResult(intent,20);});
  final boolean[] busy={false};
  action(l,item==null?"Publish listing":"Save changes",true,()->{
   if(busy[0])return;
   Map<String,Object> fields=new HashMap<>();
   try{double amount=Double.parseDouble(price.getText().toString());if(!Double.isFinite(amount)||amount<0)throw new NumberFormatException();fields.put("price",amount);}catch(NumberFormatException e){price.setError("Enter a nonnegative price");return;}
   if(title.getText().toString().trim().isEmpty()){title.setError("Enter a title");return;}
   fields.put("title",title.getText().toString().trim());fields.put("description",description.getText().toString());fields.put("category",cat.getSelectedItem().toString());fields.put("condition",condition.getSelectedItem().toString());
   if(isbn.length()>0)fields.put("isbn",isbn.getText().toString());
   busy[0]=true;String selectedPhoto=photo;
   imageWorker.execute(()->{
    try{
     if(!selectedPhoto.isEmpty()){
      String encoded=encodePhoto(selectedPhoto);
      if(item==null)fields.put("imageBase64",Collections.singletonList(encoded));else{Map<String,Object> op=new HashMap<>();op.put("action","insert");op.put("location",-1);op.put("imageBase64",encoded);fields.put("imgs",Collections.singletonList(op));}
     }
     runOnUiThread(()->{if(root!=page||isDestroyed())return;request(item==null?api.createListing(fields):api.updateListing(item.id,fields),result->{busy[0]=false;photo="";if(root==page){home("Account");info("Saved",result.message);}},()->{busy[0]=false;if(root==page)info("Could not save listing",apiError);});});
    }catch(Exception e){runOnUiThread(()->{busy[0]=false;if(root==page)info("Photo unavailable","Choose a readable image. The upload must be under 2 MB.");});}
   });
  });
  if(item!=null){for(int n=0;n<item.images.size();n++){final int index=n;image(l,item.images.get(n),150);action(l,"Remove photo "+(n+1),false,()->{Map<String,Object> op=new HashMap<>();op.put("action","delete");op.put("location",index);Map<String,Object> body=new HashMap<>();body.put("imgs",Collections.singletonList(op));request(api.updateListing(item.id,body),r->{if(root==page)home("Account");},()->info("Could not remove image",apiError));});}
   action(l,"Mark sold",false,()->listingStatus(item,"Sold"));action(l,"Renew listing",false,()->listingStatus(item,"Renew"));
   action(l,"Delete listing",false,()->new AlertDialog.Builder(this).setTitle("Delete this listing?").setMessage("This removes the listing from your account.").setPositiveButton("Delete",(a,b)->request(api.deleteListing(item.id),r->{if(root==page)home("Account");},()->info("Could not delete",apiError))).setNegativeButton("Cancel",null).show());
  }
 }
 void listingStatus(Item i,String status){Map<String,Object> body=new HashMap<>();body.put("status",status);LinearLayout page=root;request(api.updateListing(i.id,body),r->{if(root==page)home("Account");},()->info("Could not update status",apiError));}
 String encodePhoto(String uri)throws Exception{
  android.graphics.BitmapFactory.Options o=new android.graphics.BitmapFactory.Options();o.inJustDecodeBounds=true;
  try(java.io.InputStream in=getContentResolver().openInputStream(Uri.parse(uri))){android.graphics.BitmapFactory.decodeStream(in,null,o);}
  if(o.outWidth<=0||o.outHeight<=0)throw new java.io.IOException();o.inSampleSize=1;while(o.outWidth/o.inSampleSize>1600||o.outHeight/o.inSampleSize>1600)o.inSampleSize*=2;o.inJustDecodeBounds=false;
  android.graphics.Bitmap bitmap;try(java.io.InputStream in=getContentResolver().openInputStream(Uri.parse(uri))){bitmap=android.graphics.BitmapFactory.decodeStream(in,null,o);}if(bitmap==null)throw new java.io.IOException();
  java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG,85,bytes);bitmap.recycle();if(bytes.size()>2*1024*1024)throw new java.io.IOException();return android.util.Base64.encodeToString(bytes.toByteArray(),android.util.Base64.NO_WRAP);
 }
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==20&&result==RESULT_OK&&data!=null&&data.getData()!=null){Uri uri=data.getData();try{getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);photo=uri.toString();ImageView preview=root.findViewWithTag("photoPreview");if(preview!=null)setImage(preview,photo);TextView status=root.findViewWithTag("photoStatus");if(status!=null)status.setText("Photo selected");}catch(SecurityException e){info("Photo access","Choose a photo that allows persistent access.");}}}
 void compose(Item item,long threadId){LinearLayout l=col();pad(l,20);EditText message=field(l,"Message","Hi, is this still available?",false);message.setSingleLine(false);EditText amount=field(l,"Offer amount (optional)","Leave blank for a message",false);amount.setInputType(8194);copy(l,"Offers are messages, not payments or accepted purchases.");AlertDialog dialog=new AlertDialog.Builder(this).setTitle(item==null?"Reply / make offer":item.title).setView(l).setPositiveButton("Send",null).setNegativeButton("Cancel",null).create();dialog.setOnShowListener(v->dialog.getButton(-1).setOnClickListener(w->{Map<String,Object> body=new HashMap<>();body.put(threadId>0?"conversation_id":"listing_id",threadId>0?threadId:Long.parseLong(item.id));body.put("text",message.getText().toString().trim());body.put("kind",amount.length()==0?"message":"offer");if(amount.length()>0){try{double offer=Double.parseDouble(amount.getText().toString());if(!Double.isFinite(offer)||offer<=0||offer>1000000)throw new NumberFormatException();body.put("amount",offer);}catch(NumberFormatException e){amount.setError("Enter an amount greater than 0, up to 1000000");return;}}else if(message.getText().toString().trim().isEmpty()){message.setError("Write a message first");return;}dialog.getButton(-1).setEnabled(false);LinearLayout page=root;request(api.send(body),r->{dialog.dismiss();if(root==page)thread(r.conversation_id,threadId>0);},()->{dialog.getButton(-1).setEnabled(true);if(root==page)info("Could not send",apiError);});}));dialog.show();}
 void inbox(LinearLayout l){label(l,"Your campus conversations",28,true);if(!requireLogin()){copy(l,"Log in to view messages.");return;}LinearLayout page=root;ProgressBar progress=new ProgressBar(this);l.addView(progress);request(api.conversations(),values->{if(root!=page)return;l.removeView(progress);if(values.isEmpty())copy(l,"No conversations yet. Open a find and message the seller.");for(MarketplaceApi.Conversation c:values){gap(l,12);label(l,c.listing_title,20,true);copy(l,c.other_name+" · "+c.unread+" unread");copy(l,c.last_kind.equals("offer")?"Offer: "+money(c.last_amount==null?0:c.last_amount):c.last_text);action(l,"Open conversation",false,()->thread(c.id,false));}action(l,"Refresh inbox",false,()->home("Inbox"));},()->{if(root==page){l.removeView(progress);copy(l,apiError);action(l,"Retry",false,()->home("Inbox"));}});}
 void thread(long id,boolean append){if(!requireLogin())return;if(!append||conversationId!=id)threadMessages.clear();conversationId=id;base("thread");LinearLayout page=root,l=scroll();action(l,"← Inbox",false,()->home("Inbox"));label(l,"Conversation",28,true);ProgressBar progress=new ProgressBar(this);l.addView(progress);Long after=threadMessages.isEmpty()?null:threadMessages.get(threadMessages.size()-1).id;request(api.messages(id,after),data->{if(root!=page)return;threadMessages.addAll(data.messages);l.removeView(progress);for(MarketplaceApi.Message m:threadMessages){gap(l,12);label(l,m.mine?"You":"Campus member",16,true);if("offer".equals(m.kind))copy(l,"Offer: "+money(m.amount==null?0:m.amount));if(m.text!=null)copy(l,m.text);copy(l,m.datetime+(m.mine?(m.read?" · Read":" · Sent"):""));}copy(l,"Messages load in pages of up to 200. Offers have no acceptance/payment workflow.");action(l,"Load newer messages",false,()->thread(id,true));action(l,"Reply / make offer",true,()->compose(null,id));},()->{if(root==page){l.removeView(progress);copy(l,apiError);action(l,"Retry",false,()->thread(id,append));}});}
 void account(LinearLayout l){label(l,"Your corner of campus",28,true);if(signedProfile==null||session.isEmpty()){copy(l,"Join the exchange to pass things on and connect with your campus.");action(l,"Log in",true,()->auth(false));action(l,"Create account",false,()->auth(true));return;}LinearLayout page=root;MarketplaceApi.Profile p=signedProfile;label(l,p.first_name+" "+p.last_name,22,true);copy(l,p.email+" · @"+p.user);copy(l,p.school+" · "+(p.location==null?"Location not provided":p.location));action(l,"Edit profile",false,()->profileForm(p));action(l,"Refresh profile",false,()->request(api.profile(),r->{signedProfile=r.profile;session=r.profile.email;if(root==page)home("Account");},()->info("Profile unavailable",apiError)));action(l,"View saved finds",false,()->home("Saved"));action(l,"Post a campus find",true,()->home("Post"));gap(l,24);label(l,"My listings",22,true);request(api.mine(),values->{if(root!=page)return;if(values.isEmpty())copy(l,"Your next chapter starts with your first listing.");for(MarketplaceApi.Listing v:values){Item item=apiItem(v,String.valueOf(v.id));action(l,item.title+" · "+money(item.price)+" · "+item.status,false,()->{request(api.detail(item.id),detail->{if(root==page)editListing(apiItem(detail,item.id));},()->info("Listing unavailable",apiError));});}},()->{if(root==page)copy(l,apiError);});action(l,"Log out",false,()->request(api.logout(Collections.emptyMap()),r->{signedProfile=null;session="";home("Account");},()->info("Could not log out",apiError)));action(l,"Replay welcome screen",false,()->onboarding());loadDirectories();}
 void profileForm(MarketplaceApi.Profile p){base("profile");LinearLayout page=root,l=scroll();action(l,"← Account",false,()->home("Account"));label(l,"Your profile",28,true);EditText first=field(l,"First name","First name",false),last=field(l,"Last name","Last name",false),email=field(l,"Email","Email",false),user=field(l,"Username","Username",false),location=field(l,"Pickup location","Campus or meeting place",false);first.setText(p.first_name);last.setText(p.last_name);email.setText(p.email);user.setText(p.user);location.setText(p.location);EditText password=field(l,"New password (optional)","Leave blank to keep password",true);Spinner school=new Spinner(this);l.addView(school);school.setEnabled(false);request(api.schools(),r->{if(root==page&&r.schools!=null&&!r.schools.isEmpty()){school.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,r.schools));school.setSelection(Math.max(0,r.schools.indexOf(p.school)));school.setEnabled(true);}},()->info("Schools unavailable",apiError));final boolean[] busy={false};action(l,"Save profile",true,()->{if(busy[0])return;Map<String,Object> body=new HashMap<>();String[] keys={"first_name","last_name","email","user","location","password"};EditText[] fields={first,last,email,user,location,password};for(int n=0;n<keys.length;n++)if(fields[n].length()>0)body.put(keys[n],fields[n].getText().toString());if(school.isEnabled())body.put("school",school.getSelectedItem().toString());busy[0]=true;request(api.updateProfile(body),r->{busy[0]=false;if(r.profile!=null){signedProfile=r.profile;session=r.profile.email;}if(root==page){home("Account");info("Profile",r.message);}},()->{busy[0]=false;if(root==page)info("Could not update profile",apiError);});});}
 void info(String title,String content){new AlertDialog.Builder(this).setTitle(title).setMessage(content).setPositiveButton("OK",null).show();}
 boolean marketplaceVisible(){return screen.equals("home")&&(tab.equals("Explore")||tab.equals("Saved"));}
 String networkError(){return BuildConfig.LOCAL_MOCK?"Could not reach the local marketplace. Start the development adapter on your Mac, then retry.":"Could not reach the marketplace adapter. Check your connection, then retry.";}
 <T> void request(Call<T> call, java.util.function.Consumer<T> success, Runnable failure){
  activeCalls.add(call);
  call.enqueue(new Callback<T>(){
   public void onResponse(Call<T> c,Response<T> response){activeCalls.remove(c);if(isFinishing()||isDestroyed()||c.isCanceled())return;
    if(response.isSuccessful()&&response.body()!=null){try{success.accept(response.body());}catch(RuntimeException e){apiError="The adapter returned an unexpected response.";failure.run();}}
    else {apiError="The adapter could not complete this request (HTTP "+response.code()+").";try{if(response.errorBody()!=null){String message=new JSONObject(response.errorBody().string()).optString("message","");if(!message.isEmpty())apiError=message;}}catch(Exception ignored){}if(response.code()==401){signedProfile=null;session="";}failure.run();}
    if(response.errorBody()!=null)response.errorBody().close();
   }
   public void onFailure(Call<T> c,Throwable error){apiError=networkError();if((getApplicationInfo().flags&android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)!=0)android.util.Log.w("StudentExchange","Adapter transport failure: "+error.getClass().getSimpleName()+": "+error.getMessage());activeCalls.remove(c);if(!c.isCanceled()&&!isFinishing()&&!isDestroyed())failure.run();}
  });
 }
 void renderCategories(){
  if(categoryChips==null)return;categoryChips.removeAllViews();
  for(String c:categories){TextView b=text(c,13,false);pad(b,12);b.setTextColor(category.equals(c)?Color.WHITE:INK);b.setBackground(shape(category.equals(c)?GREEN:Color.WHITE,30));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-2,-2);p.setMargins(0,d(14),d(8),d(14));categoryChips.addView(b,p);b.setOnClickListener(v->{category=c;renderCategories();fetchListings();});}
 }
 void loadDirectories(){
  if(directoriesReady||loadingDirectories)return;
  loadingDirectories=true;directoryError="";final int[] left={2};final boolean[] failed={false};
  Runnable done=()->{if(--left[0]!=0)return;loadingDirectories=false;directoriesReady=!failed[0];if(failed[0])directoryError="Some marketplace filters could not load.";if(marketplaceVisible()){renderCategories();renderGrid(tab.equals("Saved"));}};
  request(api.categories(),names->{ArrayList<String> values=new ArrayList<>();values.add("All finds");for(String name:names)if(name!=null&&!name.trim().isEmpty()&&!values.contains(name))values.add(name);categories=values.toArray(new String[0]);done.run();},()->{failed[0]=true;done.run();});
  request(api.conditions(),names->{conditions.clear();for(String name:names)if(name!=null&&!name.trim().isEmpty()&&!conditions.contains(name))conditions.add(name);done.run();},()->{failed[0]=true;done.run();});
 }
 Item apiItem(MarketplaceApi.Listing value,String id){
  if(value.title==null||value.category==null||value.condition==null||value.price==null||!Double.isFinite(value.price)||value.price<0)throw new IllegalArgumentException();
  try{
   Item i=new Item(new JSONObject().put("id",id).put("title",value.title).put("category",value.category).put("description",value.description==null?"":value.description).put("campus",value.location==null||value.location.isEmpty()?"Location not provided":value.location).put("image",value.image_url==null?"books":value.image_url).put("owner",value.user==null?"":value.user).put("price",value.price).put("used",!value.condition.equalsIgnoreCase("New")));
   i.status=value.status==null?"":value.status;i.isbn=value.isbn==null?"":value.isbn;if(value.images_url!=null){i.images.addAll(value.images_url);if(!i.images.isEmpty())i.image=i.images.get(0);}
   i.condition=value.condition;i.seller=((value.first_name==null?"":value.first_name)+" "+(value.last_name==null?"":value.last_name)).trim();return i;
  }catch(JSONException e){throw new IllegalArgumentException(e);}
 }
 void fetchListings(){
  if(!marketplaceVisible())return;
  if(listingCall!=null)listingCall.cancel();final int generation=++listingGeneration;
  loadingListings=true;listingError="";renderGrid(tab.equals("Saved"));
  listingCall=api.listings(query.trim().isEmpty()?null:query.trim().substring(0,Math.min(200,query.trim().length())),category.equals("All finds")?null:category);
  request(listingCall,values->{if(generation!=listingGeneration||!marketplaceVisible())return;ArrayList<Item> loaded=new ArrayList<>();for(MarketplaceApi.Listing v:values){if(v.id==null||v.id<=0)throw new IllegalArgumentException();loaded.add(apiItem(v,String.valueOf(v.id)));}items=loaded;loadingListings=false;renderGrid(tab.equals("Saved"));},()->{if(generation!=listingGeneration||!marketplaceVisible())return;loadingListings=false;listingError=networkError();renderGrid(tab.equals("Saved"));});
 }
 void detail(Item item){
  if(!item.id.matches("[1-9][0-9]*")){info("Local sample","This item is not part of the mock API marketplace.");return;}
  activeItem=item.id;base("detail");LinearLayout loadingRoot=root;LinearLayout l=scroll();action(l,"← Campus finds",false,()->home(tab));l.addView(new ProgressBar(this));copy(l,"Loading campus find…");
  request(api.detail(item.id),value->{if(root!=loadingRoot)return;showDetail(apiItem(value,item.id));},()->{if(root!=loadingRoot)return;l.removeAllViews();action(l,"← Campus finds",false,()->home(tab));copy(l,"Could not load this listing. Check the adapter and try again.");action(l,"Retry",false,()->detail(item));});
 }
 @Override protected void onDestroy(){imageWorker.shutdownNow();synchronized(imageBodies){for(okhttp3.ResponseBody body:imageBodies)body.close();imageBodies.clear();}networkHandler.removeCallbacksAndMessages(null);for(Call<?> call:new ArrayList<>(activeCalls))call.cancel();activeCalls.clear();super.onDestroy();}
 void collectFields(View view,ArrayList<EditText> out){if(view instanceof EditText)out.add((EditText)view);else if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++)collectFields(group.getChildAt(i),out);}}
 @Override protected void onSaveInstanceState(Bundle out){super.onSaveInstanceState(out);out.putLong("conversationId",conversationId);out.putString("tab",tab);out.putString("category",category);out.putString("query",query);out.putString("photo",photo);out.putBoolean("usedOnly",usedOnly);out.putDouble("maxPrice",maxPrice);out.putString("item",activeItem);out.putString("screen",screen);out.putString("conditionFilter",conditionFilter);ArrayList<EditText> fields=new ArrayList<>();collectFields(root,fields);ArrayList<String> values=new ArrayList<>();for(EditText f:fields)values.add(f.getInputType()==129?"":f.getText().toString());out.putStringArrayList("fields",values);}
 @Override public void onBackPressed(){if(!screen.equals("home"))home(tab);else if(!tab.equals("Explore"))home("Explore");else super.onBackPressed();}
}
