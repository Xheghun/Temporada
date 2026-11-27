package com.cremedigital.seasonalworker;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/** Native private-data sentinel for package-isolation tests; no worker records. */
public final class IsolationFixture extends Activity {
    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        try (FileOutputStream output = openFileOutput("isolation-sentinel", MODE_PRIVATE)) {
            output.write("fictional normal-package data".getBytes(StandardCharsets.UTF_8));
        } catch (IOException error) {
            throw new IllegalStateException("Could not prepare isolation sentinel", error);
        }
        TextView label = new TextView(this);
        label.setText("Native package-isolation fixture");
        setContentView(label);
    }
}
