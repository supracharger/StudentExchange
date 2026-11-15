package com.studentexchange.mobile.api;

import java.io.IOException;
import com.studentexchange.mobile.BuildConfig;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import okhttp3.*;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public final class ApiClient {
 public static final String BASE_URL = BuildConfig.ADAPTER_BASE_URL;
 private static final HttpUrl ADAPTER = HttpUrl.get(BASE_URL);
 private static final String ORIGIN = ADAPTER.newBuilder().encodedPath("/").query(null).fragment(null).build().toString().replaceAll("/$", "");
 private ApiClient() {}
 // Process-only opaque adapter cookies. No passwords, application secrets or user tokens on disk.
 private static final CookieJar SESSIONS = new CookieJar() {
  private final List<Cookie> cookies = new ArrayList<>();
  public synchronized void saveFromResponse(HttpUrl url,List<Cookie> values) {
   for(Cookie c:values) if(c.name().equals("se_session")) {
    cookies.clear(); if(c.expiresAt()>System.currentTimeMillis()) cookies.add(c);
   }
  }
  public synchronized List<Cookie> loadForRequest(HttpUrl url) {
   cookies.removeIf(c->c.expiresAt()<=System.currentTimeMillis());
   List<Cookie> result=new ArrayList<>();for(Cookie c:cookies)if(c.matches(url))result.add(c);return result;
  }
 };
 private static MarketplaceApi api;
 public static synchronized MarketplaceApi create() {
  if(api!=null)return api;
  boolean validBase=ADAPTER.encodedPath().equals("/")&&ADAPTER.username().isEmpty()&&ADAPTER.password().isEmpty()&&ADAPTER.query()==null&&ADAPTER.fragment()==null;
  if(BuildConfig.LOCAL_MOCK)validBase&=ADAPTER.scheme().equals("http")&&ADAPTER.host().equals("10.0.2.2")&&ADAPTER.port()==3100;
  else validBase&=ADAPTER.scheme().equals("https")&&ADAPTER.port()==443&&!ADAPTER.host().equals("studentexchangebck-fpdnfpcqe4bje2eh.westus-01.azurewebsites.net");
  if(!validBase)throw new IllegalStateException("Invalid adapter origin configuration.");
  OkHttpClient client = new OkHttpClient.Builder()
   .proxy(java.net.Proxy.NO_PROXY) // Keep local mock traffic out of device/system proxies.
   .connectionPool(new ConnectionPool(0, 1, TimeUnit.SECONDS)) // Avoid stale local Node keep-alive sockets without retrying writes.
   .connectTimeout(BuildConfig.LOCAL_MOCK?5:15, TimeUnit.SECONDS).readTimeout(BuildConfig.LOCAL_MOCK?30:200, TimeUnit.SECONDS)
   .writeTimeout(30,TimeUnit.SECONDS).callTimeout(BuildConfig.LOCAL_MOCK?40:240, TimeUnit.SECONDS).cookieJar(SESSIONS)
   .retryOnConnectionFailure(false).followRedirects(false).followSslRedirects(false)
   .addInterceptor(chain -> {
    HttpUrl url = chain.request().url();
    String path = url.encodedPath(),method=chain.request().method();
    boolean allowed = method.equals("GET") && (path.matches("/api/(listings(/[1-9][0-9]*)?|my-listings|categories|conditions|schools|profile|messages(/(unread|[1-9][0-9]*))?)") || path.matches("/api/images/[A-Za-z0-9_-]+\\.(png|jpg|jpeg|webp)"))
     || method.equals("POST") && path.matches("/api/(register|login|logout|listings|messages)")
     || method.equals("PATCH") && path.matches("/api/(profile|listings/[1-9][0-9]*)")
     || method.equals("DELETE") && path.matches("/api/listings/[1-9][0-9]*");
    if (!url.scheme().equals(ADAPTER.scheme()) || !url.host().equals(ADAPTER.host()) || url.port() != ADAPTER.port() || !url.username().isEmpty() || !url.password().isEmpty() || !allowed)
     throw new IOException("Only the configured adapter is allowed.");
    return chain.proceed(chain.request().newBuilder().header("Origin",ORIGIN).build());
   }).build();
  api = new Retrofit.Builder().baseUrl(BASE_URL).client(client)
   .addConverterFactory(GsonConverterFactory.create()).build().create(MarketplaceApi.class);
  return api;
 }
}
