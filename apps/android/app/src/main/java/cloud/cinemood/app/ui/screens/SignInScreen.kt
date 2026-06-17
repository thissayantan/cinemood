package cloud.cinemood.app.ui.screens

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import cloud.cinemood.app.ui.theme.*

private const val BASE_URL = "https://cinemood.sayantan.cloud"

@Composable
fun SignInScreen(
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(CineMoodPaper),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier            = Modifier.padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Wordmark
            Text(
                text  = "Cinemood",
                style = MaterialTheme.typography.headlineLarge.copy(color = CineMoodInk),
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text      = "Movies and series, found by mood.",
                style     = MaterialTheme.typography.bodyMedium.copy(color = CineMoodDim),
                textAlign = TextAlign.Center,
            )

            Spacer(modifier = Modifier.height(48.dp))

            // Sign-in button — opens Google OAuth in a Custom Tab
            Button(
                onClick  = { launchGoogleAuth(context) },
                shape    = RoundedCornerShape(12.dp),
                colors   = ButtonDefaults.buttonColors(
                    containerColor = CineMoodAccent,
                    contentColor   = Color.White,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
            ) {
                Text(
                    text  = "Sign in with Google",
                    style = MaterialTheme.typography.titleMedium.copy(color = Color.White),
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text      = "Your watchlist, your preferences.\nNo account sharing.",
                style     = MaterialTheme.typography.bodySmall.copy(color = CineMoodFaint),
                textAlign = TextAlign.Center,
            )
        }
    }
}

private fun launchGoogleAuth(context: Context) {
    val authUrl = Uri.parse("$BASE_URL/auth/google?device=android")
    CustomTabsIntent.Builder()
        .setUrlBarHidingEnabled(true)
        .build()
        .launchUrl(context, authUrl)
}
