package com.karelisio.tessel;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Le plugin local doit être enregistré avant la création du pont Capacitor.
        registerPlugin(TesselNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
