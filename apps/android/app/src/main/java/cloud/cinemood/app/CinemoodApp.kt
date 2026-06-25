package cloud.cinemood.app

import android.app.Application
import cloud.cinemood.app.data.api.CinemoodApi
import cloud.cinemood.app.data.auth.TokenStore
import cloud.cinemood.app.data.local.WatchlistCache
import cloud.cinemood.app.data.settings.SettingsStore

class CinemoodApp : Application() {

    lateinit var tokenStore: TokenStore
        private set

    lateinit var settingsStore: SettingsStore
        private set

    lateinit var api: CinemoodApi
        private set

    lateinit var watchlistCache: WatchlistCache
        private set

    override fun onCreate() {
        super.onCreate()
        tokenStore     = TokenStore(this)
        settingsStore  = SettingsStore(this)
        api            = CinemoodApi(tokenStore)
        watchlistCache = WatchlistCache(this)
    }
}
