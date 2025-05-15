import { expect } from 'chai'
import { screen, render } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import LinkingSection from '@/features/settings/components/linking-section'
import { UserProvider } from '@/shared/context/user-context'
import { SSOProvider } from '@/features/settings/context/sso-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'

function renderSectionWithProviders() {
  render(<LinkingSection />, {
    wrapper: ({ children }) => (
      <SplitTestProvider>
        <UserProvider>
          <SSOProvider>{children}</SSOProvider>
        </UserProvider>
      </SplitTestProvider>
    ),
  })
}

const mockOauthProviders = {
  google: {
    descriptionKey: 'login_with_service',
    descriptionOptions: { service: 'Google' },
    name: 'Google',
    linkPath: '/auth/google',
  },
  orcid: {
    descriptionKey: 'oauth_orcid_description',
    descriptionOptions: {
      link: '/blog/434',
      appName: 'Overleaf',
    },
    name: 'ORCID',
    linkPath: '/auth/orcid',
  },
}

describe('<LinkingSection />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-user', {})

    // suppress integrations and references widgets as they cannot be tested in
    // all environments
    window.metaAttributesCache.set('ol-hideLinkingWidgets', true)

    window.metaAttributesCache.set('ol-thirdPartyIds', {
      google: 'google-id',
    })

    window.metaAttributesCache.set('ol-oauthProviders', mockOauthProviders)
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows header', async function () {
    renderSectionWithProviders()

    screen.getByText('Integrations')
    screen.getByText(
      'You can link your Overleaf account with other services to enable the features described below.'
    )
  })

  it('lists SSO providers', async function () {
    renderSectionWithProviders()
    screen.getByText('linked accounts')

    screen.getByText('Google')
    screen.getByText('Log in with Google.')
    screen.getByRole('button', { name: /unlink/i })

    screen.getByText('ORCID')
    screen.getByText(
      /Securely establish your identity by linking your ORCID iD/
    )
    const helpLink = screen.getByRole('link', {
      name: /learn more about orcid/i,
    })
    expect(helpLink.getAttribute('href')).to.equal('/blog/434')
    const linkButton = screen.getByRole('link', { name: /link orcid/i })
    expect(linkButton.getAttribute('href')).to.equal('/auth/orcid?intent=link')
  })

  it('shows SSO error message', async function () {
    window.metaAttributesCache.set('ol-ssoErrorMessage', 'You no SSO')
    renderSectionWithProviders()
    screen.getByText('Error linking account: You no SSO')
  })

  it('does not show providers section when empty', async function () {
    window.metaAttributesCache.delete('ol-oauthProviders')
    renderSectionWithProviders()

    expect(screen.queryByText('linked accounts')).to.not.exist
  })
})
