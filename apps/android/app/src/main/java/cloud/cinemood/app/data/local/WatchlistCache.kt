package cloud.cinemood.app.data.local

import android.content.Context
import cloud.cinemood.app.data.model.WatchlistItem
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class WatchlistCache(context: Context) {

    private val prefs = context.getSharedPreferences("cinemood_wl_cache", Context.MODE_PRIVATE)
    private val json  = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    fun save(items: List<WatchlistItem>) {
        prefs.edit().putString(KEY, json.encodeToString(items)).apply()
    }

    fun load(): List<WatchlistItem> = runCatching {
        val s = prefs.getString(KEY, null) ?: return emptyList()
        json.decodeFromString<List<WatchlistItem>>(s)
    }.getOrDefault(emptyList())

    fun clear() {
        prefs.edit().remove(KEY).apply()
    }

    companion object {
        private const val KEY = "wl_v1"
    }
}
