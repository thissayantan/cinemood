package cloud.cinemood.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
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
import cloud.cinemood.app.data.model.UserProfile
import cloud.cinemood.app.data.model.WatchlistItem
import cloud.cinemood.app.data.settings.SettingsStore
import cloud.cinemood.app.navigation.Screen
import cloud.cinemood.app.ui.components.AssistantFab
import cloud.cinemood.app.ui.components.HazeBottomNav
import cloud.cinemood.app.ui.screens.*
import cloud.cinemood.app.ui.screens.decide.DecideScreen
import cloud.cinemood.app.ui.screens.decide.DecideViewModel
import cloud.cinemood.app.ui.splash.BrandReveal
import cloud.cinemood.app.ui.theme.CinemoodTheme
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeSource
import kotlinx.coroutines.launch

// ── App-level ViewModel ───────────────────────────────────────────────────────

class AppViewModel(
    private val tokenStore: TokenStore,
    private val api: CinemoodApi,
    val settingsStore: SettingsStore,
) : ViewModel() {

    var isSignedIn  by mutableStateOf(tokenStore.hasToken())
    var authError   by mutableStateOf<String?>(null)
    var userProfile by mutableStateOf<UserProfile?>(null)

    // Shared watchlist cache — single source of truth across all tabs
    var sharedWatchlist by mutableStateOf<List<WatchlistItem>>(emptyList())
        private set

    // Pending item for Detail navigation (avoids ID-only nav gap)
    var pendingDetailItem by mutableStateOf<WatchlistItem?>(null)

    init {
        if (isSignedIn) {
            fetchProfile()
            loadSharedWatchlist()
        }
    }

    fun loadSharedWatchlist() {
        viewModelScope.launch {
            api.listWatchlist(limit = 500).onSuccess { sharedWatchlist = it }
        }
    }

    fun addToSharedWatchlist(item: WatchlistItem) {
        if (sharedWatchlist.none { it.title.id == item.title.id }) {
            sharedWatchlist = sharedWatchlist + item
        }
    }

    fun updateStatusInCache(titleId: Int, status: String) {
        sharedWatchlist = sharedWatchlist.map {
            if (it.title.id == titleId) it.copy(status = status) else it
        }
    }

    fun removeFromCache(titleId: Int) {
        sharedWatchlist = sharedWatchlist.filter { it.title.id != titleId }
    }

    private fun fetchProfile() {
        viewModelScope.launch {
            api.getMe().onSuccess { userProfile = it }
        }
    }

    fun handleDeviceCode(code: String) {
        viewModelScope.launch {
            api.exchangeDeviceCode(code)
                .onSuccess { result ->
                    tokenStore.saveToken(result.token)
                    authError  = null
                    isSignedIn = true
                    fetchProfile()
                    loadSharedWatchlist()
                }
                .onFailure { err ->
                    android.util.Log.e("Cinemood", "Device code exchange failed", err)
                    authError = err.message ?: "Sign-in failed. Please try again."
                }
        }
    }

    fun signOut() {
        tokenStore.clearToken()
        authError        = null
        isSignedIn       = false
        userProfile      = null
        sharedWatchlist  = emptyList()
        pendingDetailItem = null
    }

    class Factory(
        private val tokenStore: TokenStore,
        private val api: CinemoodApi,
        private val settingsStore: SettingsStore,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            AppViewModel(tokenStore, api, settingsStore) as T
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

private fun decideVmFactory(api: CinemoodApi) = object : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = DecideViewModel(api) as T
}

private fun assistantVmFactory(api: CinemoodApi) = object : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = AssistantViewModel(api) as T
}

// ── MainActivity ──────────────────────────────────────────────────────────────

class MainActivity : ComponentActivity() {

    private lateinit var appVm: AppViewModel

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
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = application as CinemoodApp

        appVm = ViewModelProvider(
            this,
            AppViewModel.Factory(app.tokenStore, app.api, app.settingsStore),
        )[AppViewModel::class.java]

        extractDeviceCode(intent)?.let { appVm.handleDeviceCode(it) }

        setContent {
            val settings = appVm.settingsStore
            val darkTheme = when (settings.themeMode) {
                SettingsStore.THEME_DARK  -> true
                SettingsStore.THEME_LIGHT -> false
                else                      -> isSystemInDarkTheme()
            }

            CinemoodTheme(darkTheme = darkTheme) {
                var showReveal by remember { mutableStateOf(true) }
                Box(modifier = Modifier.fillMaxSize()) {
                    if (!appVm.isSignedIn) {
                        SignInScreen(authError = appVm.authError)
                    } else {
                        MainScaffold(
                            api           = app.api,
                            appVm         = appVm,
                            onSignOut     = { appVm.signOut() },
                        )
                    }
                    if (showReveal) {
                        BrandReveal(onFinished = { showReveal = false })
                    }
                }
            }
        }
    }
}

// ── Main scaffold with bottom nav + assistant FAB ─────────────────────────────

@Composable
fun MainScaffold(
    api:       CinemoodApi,
    appVm:     AppViewModel,
    onSignOut: () -> Unit,
) {
    val navController = rememberNavController()
    val backStack     by navController.currentBackStackEntryAsState()
    val currentRoute  = backStack?.destination?.route
    val hazeState     = remember { HazeState() }

    val homeVm      = androidx.lifecycle.viewmodel.compose.viewModel<HomeViewModel>(factory = homeVmFactory(api))
    val watchlistVm = androidx.lifecycle.viewmodel.compose.viewModel<WatchlistViewModel>(factory = watchlistVmFactory(api))
    val decideVm    = androidx.lifecycle.viewmodel.compose.viewModel<DecideViewModel>(factory = decideVmFactory(api))
    val assistantVm = androidx.lifecycle.viewmodel.compose.viewModel<AssistantViewModel>(factory = assistantVmFactory(api))

    var showAssistant by remember { mutableStateOf(false) }

    val settings = appVm.settingsStore

    // Sync shared watchlist to per-screen VMs whenever it updates.
    // homeVm.syncWatchlist() recomputes all shelves instantly so a status flip on Detail
    // shows up immediately in Continue Watching without waiting for the 5-min cache.
    LaunchedEffect(appVm.sharedWatchlist) {
        val shared = appVm.sharedWatchlist
        if (shared.isNotEmpty()) {
            homeVm.syncWatchlist(shared)
            watchlistVm.updateAllItems(shared)
            decideVm.watchlist   = shared
        }
    }

    // Navigate to detail — ensures item is available even for Decide/mood results
    fun navigateToDetail(item: WatchlistItem) {
        appVm.pendingDetailItem = item
        navController.navigate(Screen.Detail.createRoute(item.title.id))
    }

    // Navigate to actor/person detail screen
    fun navigateToPerson(personId: Int) {
        navController.navigate(Screen.Person.createRoute(personId))
    }

    Box(modifier = Modifier.fillMaxSize()) {
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
                    onItemClick = { navigateToDetail(it) },
                )
            }
            composable(Screen.Watchlist.route) {
                WatchlistScreen(
                    vm          = watchlistVm,
                    onItemClick = { navigateToDetail(it) },
                )
            }
            composable(Screen.Decide.route) {
                DecideScreen(
                    vm          = decideVm,
                    onItemClick = { navigateToDetail(it) },
                )
            }
            composable(Screen.Settings.route) {
                SettingsScreen(
                    profile             = appVm.userProfile,
                    watchlistCounts     = watchlistVm.countByStatus,
                    settingsStore       = settings,
                    onSignOut           = onSignOut,
                    onNavigateToLibrary = { statusFilter ->
                        watchlistVm.statusFilter = statusFilter
                        navController.navigate(Screen.Watchlist.route) {
                            popUpTo(navController.graph.startDestinationId) { saveState = true }
                            launchSingleTop = true
                            restoreState    = true
                        }
                    },
                )
            }
            composable(Screen.Detail.route) { backStackEntry ->
                val titleId = backStackEntry.arguments?.getString("titleId")?.toIntOrNull()
                val item = appVm.pendingDetailItem?.takeIf { it.title.id == titleId }
                    ?: watchlistVm.allItems.find { it.title.id == titleId }
                    ?: appVm.sharedWatchlist.find { it.title.id == titleId }

                if (item != null) {
                    DetailScreen(
                        item          = item,
                        region        = settings.region,
                        onBack        = { navController.popBackStack() },
                        onSetStatus   = { status ->
                            watchlistVm.setStatus(item.title.id, status)
                            appVm.updateStatusInCache(item.title.id, status)
                        },
                        api           = api,
                        onPersonClick = { personId -> navigateToPerson(personId) },
                        onRemove      = {
                            watchlistVm.removeItem(item.title.id)
                            appVm.removeFromCache(item.title.id)
                            navController.popBackStack()
                        },
                    )
                } else {
                    Box(
                        modifier         = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) { Text("Title not found") }
                }
            }
            composable(Screen.Person.route) { backStackEntry ->
                val personId = backStackEntry.arguments?.getString("personId")?.toIntOrNull()
                if (personId != null) {
                    PersonScreen(
                        api      = api,
                        personId = personId,
                        onBack   = { navController.popBackStack() },
                    )
                } else {
                    Box(
                        modifier         = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) { Text("Person not found") }
                }
            }
        }

        // Floating glass pill nav
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

        // AI assistant FAB — only on content-browsing tabs where search is relevant
        val showFab = currentRoute == Screen.Home.route || currentRoute == Screen.Watchlist.route
        if (showFab) {
            AssistantFab(
                onClick  = { showAssistant = true },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .navigationBarsPadding()
                    .padding(end = 20.dp, bottom = 110.dp),
            )
        }
    }

    // Assistant bottom sheet
    if (showAssistant) {
        AssistantSheet(
            vm          = assistantVm,
            onItemClick = { item ->
                showAssistant = false
                navigateToDetail(item)
            },
            onDismiss   = { showAssistant = false },
        )
    }
}
