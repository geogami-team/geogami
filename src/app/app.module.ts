import { NgModule, APP_INITIALIZER } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { RouteReuseStrategy } from "@angular/router";
import { IonicModule, IonicRouteStrategy } from "@ionic/angular";
import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import {
  HttpClientModule,
  HttpClient,
  HTTP_INTERCEPTORS,
} from "@angular/common/http";
import { ServiceWorkerModule } from "@angular/service-worker";
import { environment } from "../environments/environment";
import { TranslateModule, TranslateLoader } from "@ngx-translate/core";
import { TranslateHttpLoader } from "@ngx-translate/http-loader";
import { PopoverComponent } from "./popover/popover.component";
import { FormsModule } from "@angular/forms";

// Modals
import { CreateTaskModalPage } from "./pages/create-game/create-task-modal/create-task-modal.page";
import { CreateModuleModalPage } from "./pages/create-game/create-module-modal/create-module-modal.page";
import { MapFeaturesModalPage } from "./pages/create-game/map-features-modal/map-features-modal.page";
import { CreateInfoModalComponent } from "./pages/create-game/create-info-modal/create-info-modal.component";

import { DeviceOrientation } from "@ionic-native/device-orientation/ngx";

import { IonicStorageModule } from "@ionic/storage";
import { QuestionTypeComponent } from "./pages/create-game/form-elements/question-types/question-type.component";
import { AnswerTypeComponent } from "./pages/create-game/form-elements/answer-types/answer-type.component";
import { MapComponent } from "./pages/create-game/form-elements/map/map.component";
import { PhotoUploadMultipleChoiceComponent } from "./pages/create-game/form-elements/photo-upload-multiple-choice/photo-upload-multiple-choice.component";
import { PhotoUploadComponent } from "./pages/create-game/form-elements/photo-upload/photo-upload.component";
import { MultipleChoiceTextComponent } from "./pages/create-game/form-elements/multiple-choice-text/multiple-choice-text.component";

import { TypeToTextPipe } from "./pipes/typeToText.pipe";
import { LangTranslatePipe } from "./pipes/langTranslate";
import { AudioRecorderComponent } from "./pages/create-game/form-elements/audio-recorder/audio-recorder.component";
import { AudioPlayerModule } from "./components/audio-player/audio-player.module";
import { EditorVisibilityModule } from "./components/editor-visibility/editor-visibility.module";

import { MarkdownModule } from "ngx-markdown";
import { TokenInterceptor } from "./services/token-intercepor.service";
import { HelperService } from "./services/helper.service";

// for angular material
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
// import {FormControl} from '@angular/forms';

// import { Network } from '@awesome-cordova-plugins/network/ngx';
import { Network } from "@ionic-native/network/ngx";

import { NgxQRCodeModule } from "@techiediaries/ngx-qrcode";

// AoT requires an exported function for factories
export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, "./assets/i18n/", ".json");
}

/* VR world
 * Using sockit.IO for receiving data from VR App
 */
import { SocketIoModule, SocketIoConfig } from "ngx-socket-io";
import { EnvTypeQuestionTextModule } from "./components/env-type-question-text/env-type-question-text.module";

const config: SocketIoConfig = { url: environment.apiURL, options: {} }; // openstack server

@NgModule({
    declarations: [
        AppComponent,
        PopoverComponent,
        CreateTaskModalPage,
        MapFeaturesModalPage,
        CreateModuleModalPage,
        CreateInfoModalComponent,
        MapComponent,
        PhotoUploadMultipleChoiceComponent,
        PhotoUploadComponent,
        MultipleChoiceTextComponent,
        AudioRecorderComponent,
        QuestionTypeComponent,
        AnswerTypeComponent,
        TypeToTextPipe,
        LangTranslatePipe,
        // PopupComponent,
    ],
    exports: [],
    imports: [
        AudioPlayerModule,
        EditorVisibilityModule,
        EnvTypeQuestionTextModule,
        FormsModule,
        BrowserModule,
        HttpClientModule,
        SocketIoModule.forRoot(config),
        TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: createTranslateLoader,
                deps: [HttpClient],
            },
        }),
        IonicModule.forRoot({
            backButtonText: "Zurück",
            mode: 'md'
        }),
        AppRoutingModule,
        HttpClientModule,
        ServiceWorkerModule.register("ngsw-worker.js", {
            enabled: environment.production,
        }),
        IonicStorageModule.forRoot({
            driverOrder: ["localstorage", "indexeddb"],
        }),
        MarkdownModule.forRoot(),
        BrowserAnimationsModule,
        NgxQRCodeModule,
        // FormControl
    ],
    providers: [
        { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
        DeviceOrientation,
        {
            provide: HTTP_INTERCEPTORS,
            useClass: TokenInterceptor,
            multi: true,
        },
        HelperService,
        Network,
    ],
    bootstrap: [AppComponent]
})
export class AppModule {}
