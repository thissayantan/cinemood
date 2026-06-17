package cloud.cinemood.app.data.settings

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import java.util.Locale

class SettingsStore(context: Context) {

    private val prefs = context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)

    private var _region by mutableStateOf(
        prefs.getString(KEY_REGION, null) ?: defaultRegion()
    )
    val region: String get() = _region

    private var _themeMode by mutableStateOf(
        prefs.getString(KEY_THEME, THEME_SYSTEM) ?: THEME_SYSTEM
    )
    val themeMode: String get() = _themeMode

    fun setRegion(value: String) {
        _region = value.uppercase().ifBlank { "US" }
        prefs.edit().putString(KEY_REGION, _region).apply()
    }

    fun setThemeMode(value: String) {
        _themeMode = value
        prefs.edit().putString(KEY_THEME, value).apply()
    }

    private fun defaultRegion(): String {
        val country = Locale.getDefault().country.uppercase()
        return country.ifBlank { "US" }
    }

    companion object {
        private const val PREFS_FILE = "cinemood_settings"
        private const val KEY_REGION = "region"
        private const val KEY_THEME  = "theme_mode"
        const val THEME_SYSTEM = "system"
        const val THEME_LIGHT  = "light"
        const val THEME_DARK   = "dark"
    }
}
