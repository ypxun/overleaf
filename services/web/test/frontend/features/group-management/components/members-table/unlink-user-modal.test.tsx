import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReactElement } from 'react'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'
import UnlinkUserModal from '@/features/group-management/components/members-table/unlink-user-modal'
import { GroupMembersProvider } from '@/features/group-management/context/group-members-context'
import { expect } from 'chai'

export function renderWithContext(component: ReactElement, props = {}) {
  const GroupMembersProviderWrapper = ({
    children,
  }: {
    children: ReactElement
  }) => <GroupMembersProvider {...props}>{children}</GroupMembersProvider>

  return render(component, { wrapper: GroupMembersProviderWrapper })
}

describe('<UnlinkUserModal />', function () {
  let defaultProps: any
  const groupId = 'group123'
  const userId = 'user123'

  beforeEach(function () {
    defaultProps = {
      onClose: sinon.stub(),
      user: { _id: userId },
      setGroupUserAlert: sinon.stub(),
    }
    window.metaAttributesCache.set('ol-groupId', groupId)
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('displays the modal', async function () {
    renderWithContext(<UnlinkUserModal {...defaultProps} />)
    await screen.findByRole('heading', {
      name: 'Unlink user',
    })
    screen.getByText('You’re about to remove the SSO login option for', {
      exact: false,
    })
  })

  it('closes the modal on success', async function () {
    fetchMock.post(`/manage/groups/${groupId}/unlink-user/${userId}`, 200)

    renderWithContext(<UnlinkUserModal {...defaultProps} />)
    await screen.findByRole('heading', {
      name: 'Unlink user',
    })

    const confirmButton = screen.getByRole('button', { name: 'Unlink user' })
    fireEvent.click(confirmButton)

    await waitFor(() => expect(defaultProps.onClose).to.have.been.called)
  })

  it('handles errors', async function () {
    fetchMock.post(`/manage/groups/${groupId}/unlink-user/${userId}`, 500)

    renderWithContext(<UnlinkUserModal {...defaultProps} />)
    await screen.findByRole('heading', {
      name: 'Unlink user',
    })

    const confirmButton = screen.getByRole('button', { name: 'Unlink user' })
    fireEvent.click(confirmButton)

    await waitFor(() => screen.findByText('Sorry, something went wrong'))
  })
})
