package com.studentexchange.mobile.api;

import java.util.List;
import java.util.Map;
import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.http.*;

/** Android talks only to the adapter. Application credentials and backend tokens stay server-side. */
public interface MarketplaceApi {
 @GET("api/listings") Call<List<Listing>> listings(@Query("search") String search, @Query("category") String category);
 @GET("api/listings/{id}") Call<Listing> detail(@Path("id") String id);
 @GET("api/my-listings") Call<List<Listing>> mine();
 @GET("api/categories") Call<List<String>> categories();
 @GET("api/conditions") Call<List<String>> conditions();
 @GET("api/schools") Call<Schools> schools();
 @POST("api/register") Call<Result> register(@Body Map<String,Object> body);
 @POST("api/login") Call<Result> login(@Body Map<String,Object> body);
 @POST("api/logout") Call<Result> logout(@Body Map<String,Object> body);
 @GET("api/profile") Call<Result> profile();
 @PATCH("api/profile") Call<Result> updateProfile(@Body Map<String,Object> body);
 @POST("api/listings") Call<Result> createListing(@Body Map<String,Object> body);
 @PATCH("api/listings/{id}") Call<Result> updateListing(@Path("id") String id, @Body Map<String,Object> body);
 @DELETE("api/listings/{id}") Call<Result> deleteListing(@Path("id") String id);
 @GET("api/messages") Call<List<Conversation>> conversations();
 @GET("api/messages/unread") Call<Result> unread();
 @GET("api/messages/{id}") Call<Thread> messages(@Path("id") long id, @Query("after") Long after);
 @POST("api/messages") Call<Result> send(@Body Map<String,Object> body);
 @Streaming @GET("api/images/{name}") Call<ResponseBody> image(@Path("name") String name);
 class Listing {
  public Long id;
  public String title, category, condition, location, isbn, datetime, status, user;
  public String description, first_name, last_name, image_url;
  public List<String> images_url;
  public Double price;
 }
 class Profile { public String email,first_name,last_name,school,user,location; }
 class Result { public Profile profile; public String message,email; public Long conversation_id,unread; }
 class Schools { public List<String> schools; }
 class Conversation { public long id,listing_id,unread; public String listing_title,other_name,role,last_kind,last_text,last_datetime; public Double last_amount; public boolean last_from_me; }
 class Message { public long id; public String kind,text,datetime; public Double amount; public boolean mine,read; }
 class Thread { public long conversation_id; public List<Message> messages; }
}
