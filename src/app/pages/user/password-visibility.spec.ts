import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { AuthService } from 'src/app/services/auth-service.service';
import { UtilService } from 'src/app/services/util.service';
import { LoginPage } from './login/login.page';
import { LoginPageModule } from './login/login.module';
import { ResetPasswordPage } from './reset-password/reset-password.page';
import { ResetPasswordPageModule } from './reset-password/reset-password.module';

// The show/hide password eye on the login and reset-password pages, with the
// real Ionic components (the bugs below live inside them).
//
//  - Ionic clears a password field on the first keystroke after it loses focus
//    with a value in it, and pressing the eye takes the focus away.
//  - Ionic copies an aria-label to its inner, focusable button only once, so
//    the eye would keep the name "Show password" after revealing.
//
// Without a translation loader the translate pipe shows the keys.

const pages = [
  {
    name: 'reset password',
    component: ResetPasswordPage,
    module: ResetPasswordPageModule,
    form: (page: any) => page.loginForm,
  },
  {
    name: 'login',
    component: LoginPage,
    module: LoginPageModule,
    form: (page: any) => page.loginForm,
  },
];

for (const { name, component, module, form } of pages) {
  describe(`password eye on the ${name} page`, () => {
    let fixture;
    let host: HTMLElement;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [module, IonicModule.forRoot(), TranslateModule.forRoot(), RouterTestingModule],
        providers: [
          {
            provide: AuthService,
            useValue: {
              getErrorMessage: () => of(null),
              getLoading: () => of(false),
              getRegisterStatus: () => of(null),
              setLoginPageOpen: () => {},
              login: () => {},
              resetPassword: () => {},
            },
          },
          { provide: UtilService, useValue: { showToast: () => {} } },
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
          },
        ],
      }).compileComponents();
      // The reset page reads the address handed over by the forgot-password page.
      spyOn(TestBed.inject(Router), 'getCurrentNavigation').and.returnValue({
        extras: { state: { email: 'someone@example.test' } },
      } as any);

      fixture = TestBed.createComponent(component as any);
      fixture.detectChanges();
      host = fixture.nativeElement;
    });

    // Ionic registers its components asynchronously; wait for that first.
    async function passwordInput(): Promise<HTMLInputElement> {
      await customElements.whenDefined('ion-input');
      const ionInput = host.querySelector('ion-input#password') as any;
      await ionInput.componentOnReady();
      return ionInput.getInputElement();
    }

    async function eye(): Promise<any> {
      await customElements.whenDefined('ion-button');
      const button = host.querySelector('ion-button.pw-toggle') as any;
      await button.componentOnReady();
      return button;
    }

    async function settle() {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 50)); // Ionic re-render
    }

    it('keeps the entered password when typing resumes after using the eye', async () => {
      const input = await passwordInput();
      form(fixture.componentInstance).controls.password.setValue('secret-123');
      await settle();

      // The field loses focus to the eye, which reveals and hides again...
      input.dispatchEvent(new FocusEvent('focus'));
      input.dispatchEvent(new FocusEvent('blur'));
      (await eye()).click();
      await settle();
      (await eye()).click();
      await settle();
      // ...then the next keystroke in the field.
      input.dispatchEvent(new FocusEvent('focus'));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
      await settle();

      expect((await passwordInput()).value).toBe('secret-123');
      expect(form(fixture.componentInstance).controls.password.value).toBe('secret-123');
    });

    it('is named after what it does next, also for screen readers', async () => {
      const button = await eye();
      const label = () => button.querySelector('.pw-toggle-label').textContent.trim();

      expect(label()).toBe('User.showPassword');
      expect((await passwordInput()).type).toBe('password');

      button.click();
      await settle();
      expect(label()).toBe('User.hidePassword');
      expect((await passwordInput()).type).toBe('text');

      // No aria-label anywhere that could override that text with a stale one,
      // and the icon itself isn't announced ("eye outline").
      expect(button.hasAttribute('aria-label')).toBeFalse();
      expect(button.shadowRoot.querySelector('button').hasAttribute('aria-label')).toBeFalse();
      expect(button.querySelector('ion-icon').getAttribute('aria-hidden')).toBe('true');
    });

    it('never submits the form', async () => {
      const submit = spyOn(fixture.componentInstance as any, name === 'login' ? 'login' : 'resetPassword');
      (await eye()).click();
      await settle();
      expect(submit).not.toHaveBeenCalled();
    });
  });
}
