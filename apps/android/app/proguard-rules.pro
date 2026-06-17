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
