# Preserve annotations, generics, and readable line numbers in release builds
-keepattributes *Annotation*, Signature, SourceFile, LineNumberTable

# Keep app entrypoint MainActivity
-keep class com.mmregion.town3d.** { *; }

# Keep Capacitor core bridge and WebView JavascriptInterface callbacks
-keep class com.getcapacitor.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Capacitor plugins & annotated plugin methods invoked via reflection
-keep class com.capacitorjs.plugins.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    *;
}
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep @interface com.getcapacitor.annotation.** { *; }
-keep @interface com.getcapacitor.PluginMethod { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
}
-keep class * implements com.getcapacitor.PluginHandle {
    public void invoke(java.lang.String, com.getcapacitor.PluginCall);
}

# Keep Capgo CapacitorUpdater plugin and all classes it invokes via reflection or WorkManager
-keep class ee.forgr.capacitor_updater.** { *; }
-keep class androidx.webkit.WebViewCompat { *; }
-keep class androidx.webkit.WebViewFeature { *; }
-keep class androidx.work.** { *; }
-keep class androidx.room.** { *; }
-keep class androidx.lifecycle.ProcessLifecycleOwner { *; }
-keep class androidx.lifecycle.ProcessLifecycleInitializer { *; }
-keep class androidx.lifecycle.DefaultLifecycleObserver { *; }
-keep class org.brotli.** { *; }
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# Keep AndroidX core SplashScreen classes
-keep class androidx.core.splashscreen.** { *; }

# Keep Cordova compatibility layer if referenced by plugins
-keep public class * extends org.apache.cordova.* {
    public <methods>;
    public <fields>;
}

-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
-dontwarn org.codehaus.mojo.animal_sniffer.**
