package cloud.cinemood.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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

    fun handleDeviceCode(code: String) {
        viewModelScope.launch {
            api.exchangeDeviceCode(code).onSuccess { result ->
                tokenStore.saveToken(result.token)
                isSignedIn = true
            }
        }
    }

    fun signOut() {
        tokenStore.clearToken()
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = application as CinemoodApp

        val appVm = ViewModelProvider(
            this,
            AppViewModel.Factory(app.tokenStore, app.api),
        )[AppViewModel::class.java]

        // Handle the cinemood://auth?code=… App Link that arrives after OAuth
        val incomingCode = intent?.data
            ?.takeIf { it.scheme == "cinemood" && it.host == "auth" }
            ?.getQueryParameter("code")
        if (incomingCode != null) {
            appVm.handleDeviceCode(incomingCode)
        }

        setContent {
            CinemoodTheme {
                if (!appVm.isSignedIn) {
                    SignInScreen()
                } else {
                    MainScaffold(app.api, onSignOut = { appVm.signOut() })
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
