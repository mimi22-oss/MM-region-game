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

# Keep Capgo CapacitorUpdater plugin
-keep class ee.forgr.capacitor_updater.** { *; }

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
