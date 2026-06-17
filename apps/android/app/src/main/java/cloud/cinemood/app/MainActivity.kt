package cloud.cinemood.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import cloud.cinemood.app.data.api.CinemoodApi
import cloud.cinemood.app.data.auth.TokenStore
import cloud.cinemood.app.navigation.Screen
import cloud.cinemood.app.ui.components.HazeBottomNav
import cloud.cinemood.app.ui.screens.*
import cloud.cinemood.app.ui.splash.BrandReveal
import cloud.cinemood.app.ui.theme.CinemoodTheme
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeSource
import kotlinx.coroutines.launch

// ── App-level ViewModel ───────────────────────────────────────────────────────

class AppViewModel(
    private val tokenStore: TokenStore,
    private val api: CinemoodApi,
) : ViewModel() {

    var isSignedIn by mutableStateOf(tokenStore.hasToken())
    var authError  by mutableStateOf<String?>(null)

    fun handleDeviceCode(code: String) {
        viewModelScope.launch {
            api.exchangeDeviceCode(code)
                .onSuccess { result ->
                    tokenStore.saveToken(result.token)
                    authError  = null
                    isSignedIn = true
                }
                .onFailure { err ->
                    android.util.Log.e("Cinemood", "Device code exchange failed", err)
                    authError = err.message ?: "Sign-in failed. Please try again."
                }
        }
    }

    fun signOut() {
        tokenStore.clearToken()
        authError  = null
        isSignedIn = false
    }

    class Factory(
        private val tokenStore: TokenStore,
        private val api: CinemoodApi,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            AppViewModel(tokenStore, api) as T
    }
}

// ── ViewModel factory helpers ─────────────────────────────────────────────────

private fun homeVmFactory(api: CinemoodApi) = object : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = HomeViewModel(api) as T
}

private fun watchlistVmFactory(api: CinemoodApi) = object : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = WatchlistViewModel(api) as T
}

// ── MainActivity ──────────────────────────────────────────────────────────────

class MainActivity : ComponentActivity() {

    private lateinit var appVm: AppViewModel

    // Extracts the OTC from a cinemood://auth?code=… deep-link intent.
    // Called from both onCreate (cold start) and onNewIntent (warm return from Custom Tab).
    private fun extractDeviceCode(intent: Intent?): String? =
        intent?.data
            ?.takeIf { it.scheme == "cinemood" && it.host == "auth" }
            ?.getQueryParameter("code")

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        extractDeviceCode(intent)?.let { appVm.handleDeviceCode(it) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // installSplashScreen() MUST be called before super.onCreate()
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = application as CinemoodApp

        appVm = ViewModelProvider(
            this,
            AppViewModel.Factory(app.tokenStore, app.api),
        )[AppViewModel::class.java]

        // Handle cinemood://auth?code=… if this activity was cold-launched by the deep link
        extractDeviceCode(intent)?.let { appVm.handleDeviceCode(it) }

        setContent {
            CinemoodTheme {
                var showReveal by remember { mutableStateOf(true) }
                Box(modifier = Modifier.fillMaxSize()) {
                    // Real UI renders immediately behind the reveal overlay
                    if (!appVm.isSignedIn) {
                        SignInScreen(authError = appVm.authError)
                    } else {
                        MainScaffold(app.api, onSignOut = { appVm.signOut() })
                    }
                    // Spine-line brand reveal — non-blocking (real UI loads behind it)
                    if (showReveal) {
                        BrandReveal(onFinished = { showReveal = false })
                    }
                }
            }
        }
    }
}

// ── Main scaffold with bottom nav ─────────────────────────────────────────────

@Composable
fun MainScaffold(api: CinemoodApi, onSignOut: () -> Unit) {
    val navController  = rememberNavController()
    val backStack      by navController.currentBackStackEntryAsState()
    val currentRoute   = backStack?.destination?.route
    val hazeState      = remember { HazeState() }

    val homeVm      = androidx.lifecycle.viewmodel.compose.viewModel<HomeViewModel>(factory = homeVmFactory(api))
    val watchlistVm = androidx.lifecycle.viewmodel.compose.viewModel<WatchlistViewModel>(factory = watchlistVmFactory(api))

    Box(modifier = Modifier.fillMaxSize()) {
        // Content behind the glass nav
        NavHost(
            navController    = navController,
            startDestination = Screen.Home.route,
            modifier         = Modifier
                .fillMaxSize()
                .hazeSource(state = hazeState),
        ) {
            composable(Screen.Home.route) {
                HomeScreen(
                    vm          = homeVm,
                    onItemClick = { item ->
                        navController.navigate(Screen.Detail.createRoute(item.id))
                    },
                )
            }
            composable(Screen.Watchlist.route) {
                WatchlistScreen(
                    vm          = watchlistVm,
                    onItemClick = { item ->
                        navController.navigate(Screen.Detail.createRoute(item.id))
                    },
                )
            }
            composable(Screen.Decide.route) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("Decide hub — coming next sprint")
                }
            }
            composable(Screen.Settings.route) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Settings")
                        Button(onClick = onSignOut) { Text("Sign out") }
                    }
                }
            }
            composable(Screen.Detail.route) { backStackEntry ->
                val titleId = backStackEntry.arguments?.getString("titleId")?.toIntOrNull()
                // Title detail — looks up from watchlistVm.allItems for the cached list
                val item = watchlistVm.allItems.find { it.id == titleId }
                if (item != null) {
                    DetailScreen(
                        item       = item,
                        onBack     = { navController.popBackStack() },
                        onSetStatus = { status -> watchlistVm.setStatus(item.id, status) },
                    )
                } else {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) { Text("Title not found") }
                }
            }
        }

        // Floating glass pill nav — rendered over content
        HazeBottomNav(
            currentRoute = currentRoute,
            hazeState    = hazeState,
            onNavigate   = { screen ->
                if (currentRoute != screen.route) {
                    navController.navigate(screen.route) {
                        popUpTo(navController.graph.startDestinationId) { saveState = true }
                        launchSingleTop = true
                        restoreState    = true
                    }
                }
            },
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }
}
