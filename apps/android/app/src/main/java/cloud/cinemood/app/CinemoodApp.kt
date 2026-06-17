package cloud.cinemood.app

import android.app.Application
import cloud.cinemood.app.data.api.CinemoodApi
import cloud.cinemood.app.data.auth.TokenStore

/**
 * Application class — single instances of TokenStore and CinemoodApi.
 * ViewModels access these via the Application reference; no DI framework
 * is needed at this scale.
 */
class CinemoodApp : Application() {

    lateinit var tokenStore: TokenStore
        private set

    lateinit var api: CinemoodApi
        private set

    override fun onCreate() {
        super.onCreate()
        tokenStore = TokenStore(this)
        api        = CinemoodApi(tokenStore)
    }
}
