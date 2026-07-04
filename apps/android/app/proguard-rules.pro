# Cinemood Android ProGuard rules

# Ktor — keep serialization metadata
-keep class io.ktor.** { *; }
-keep class kotlinx.serialization.** { *; }
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

# Haze
-keep class dev.chrisbanes.haze.** { *; }

# Data models (serialized by Ktor)
-keep class cloud.cinemood.app.data.model.** { *; }

# androidx.security.crypto pulls in Google Tink which references error-prone
# annotation classes that are not present on Android at runtime.
-dontwarn com.google.errorprone.annotations.**

# Ktor's IntelliJ debug detector references java.lang.management which is a
# Java SE API unavailable on Android — safe to suppress, it's a no-op at runtime.
-dontwarn java.lang.management.ManagementFactory
-dontwarn java.lang.management.RuntimeMXBean
