import {
  type ComponentProps,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { User } from '../../../../../../types/group-management/user'
import useAsync from '@/shared/hooks/use-async'
import { type FetchError, postJSON } from '@/infrastructure/fetch-json'
import { GroupUserAlert } from '../../utils/types'
import { useGroupMembersContext } from '../../context/group-members-context'
import getMeta from '@/utils/meta'
import MaterialIcon from '@/shared/components/material-icon'
import DropdownListItem from '@/features/ui/components/bootstrap-5/dropdown-list-item'
import { Spinner } from 'react-bootstrap-5'

type resendInviteResponse = {
  success: boolean
}

type ManagedUserDropdownButtonProps = {
  user: User
  openOffboardingModalForUser: (user: User) => void
  openUnlinkUserModal: (user: User) => void
  groupId: string
  setGroupUserAlert: Dispatch<SetStateAction<GroupUserAlert>>
}

export default function DropdownButton({
  user,
  openOffboardingModalForUser,
  openUnlinkUserModal,
  groupId,
  setGroupUserAlert,
}: ManagedUserDropdownButtonProps) {
  const { t } = useTranslation()
  const { removeMember } = useGroupMembersContext()
  const {
    runAsync: runResendManagedUserInviteAsync,
    isLoading: isResendingManagedUserInvite,
  } = useAsync<resendInviteResponse>()
  const {
    runAsync: runResendLinkSSOInviteAsync,
    isLoading: isResendingSSOLinkInvite,
  } = useAsync<resendInviteResponse>()
  const {
    runAsync: runResendGroupInviteAsync,
    isLoading: isResendingGroupInvite,
  } = useAsync<resendInviteResponse>()

  const managedUsersActive = getMeta('ol-managedUsersActive')
  const groupSSOActive = getMeta('ol-groupSSOActive')

  const userPending = user.invite
  const isGroupSSOLinked =
    !userPending && user.enrollment?.sso?.some(sso => sso.groupId === groupId)
  const isUserManaged = !userPending && user.enrollment?.managedBy === groupId

  const handleResendManagedUserInvite = useCallback(
    async (user: User) => {
      try {
        const result = await runResendManagedUserInviteAsync(
          postJSON(
            `/manage/groups/${groupId}/resendManagedUserInvite/${user._id}`
          )
        )

        if (result.success) {
          setGroupUserAlert({
            variant: 'resendManagedUserInviteSuccess',
            email: user.email,
          })
        }
      } catch (err) {
        if ((err as FetchError)?.response?.status === 429) {
          setGroupUserAlert({
            variant: 'resendInviteTooManyRequests',
            email: user.email,
          })
        } else {
          setGroupUserAlert({
            variant: 'resendManagedUserInviteFailed',
            email: user.email,
          })
        }
      }
    },
    [setGroupUserAlert, groupId, runResendManagedUserInviteAsync]
  )

  const handleResendLinkSSOInviteAsync = useCallback(
    async (user: User) => {
      try {
        const result = await runResendLinkSSOInviteAsync(
          postJSON(`/manage/groups/${groupId}/resendSSOLinkInvite/${user._id}`)
        )

        if (result.success) {
          setGroupUserAlert({
            variant: 'resendSSOLinkInviteSuccess',
            email: user.email,
          })
        }
      } catch (err) {
        if ((err as FetchError)?.response?.status === 429) {
          setGroupUserAlert({
            variant: 'resendInviteTooManyRequests',
            email: user.email,
          })
        } else {
          setGroupUserAlert({
            variant: 'resendSSOLinkInviteFailed',
            email: user.email,
          })
        }
      }
    },
    [setGroupUserAlert, groupId, runResendLinkSSOInviteAsync]
  )

  const handleResendGroupInvite = useCallback(
    async (user: User) => {
      try {
        await runResendGroupInviteAsync(
          postJSON(`/manage/groups/${groupId}/resendInvite/`, {
            body: {
              email: user.email,
            },
          })
        )

        setGroupUserAlert({
          variant: 'resendGroupInviteSuccess',
          email: user.email,
        })
      } catch (err) {
        if ((err as FetchError)?.response?.status === 429) {
          setGroupUserAlert({
            variant: 'resendInviteTooManyRequests',
            email: user.email,
          })
        } else {
          setGroupUserAlert({
            variant: 'resendGroupInviteFailed',
            email: user.email,
          })
        }
      }
    },
    [setGroupUserAlert, groupId, runResendGroupInviteAsync]
  )

  const onResendManagedUserInviteClick = () => {
    handleResendManagedUserInvite(user)
  }
  const onResendSSOLinkInviteClick = () => {
    handleResendLinkSSOInviteAsync(user)
  }

  const onResendGroupInviteClick = () => {
    handleResendGroupInvite(user)
  }

  const onDeleteUserClick = () => {
    openOffboardingModalForUser(user)
  }

  const onRemoveFromGroup = () => {
    removeMember(user)
  }

  const onUnlinkUserClick = () => {
    openUnlinkUserModal(user)
  }

  const buttons = []

  if (userPending) {
    buttons.push(
      <MenuItemButton
        onClick={onResendGroupInviteClick}
        key="resend-group-invite-action"
        isLoading={isResendingGroupInvite}
        data-testid="resend-group-invite-action"
      >
        {t('resend_group_invite')}
      </MenuItemButton>
    )
  }
  if (managedUsersActive && !isUserManaged && !userPending) {
    buttons.push(
      <MenuItemButton
        onClick={onResendManagedUserInviteClick}
        key="resend-managed-user-invite-action"
        isLoading={isResendingManagedUserInvite}
        data-testid="resend-managed-user-invite-action"
      >
        {t('resend_managed_user_invite')}
      </MenuItemButton>
    )
  }
  if (groupSSOActive && isGroupSSOLinked) {
    buttons.push(
      <MenuItemButton
        onClick={onUnlinkUserClick}
        key="unlink-user-action"
        data-testid="unlink-user-action"
      >
        {t('unlink_user')}
      </MenuItemButton>
    )
  }
  if (groupSSOActive && !isGroupSSOLinked && !userPending) {
    buttons.push(
      <MenuItemButton
        onClick={onResendSSOLinkInviteClick}
        key="resend-sso-link-invite-action"
        isLoading={isResendingSSOLinkInvite}
        data-testid="resend-sso-link-invite-action"
      >
        {t('resend_link_sso')}
      </MenuItemButton>
    )
  }
  if (isUserManaged && !user.isEntityAdmin) {
    buttons.push(
      <MenuItemButton
        className="delete-user-action"
        key="delete-user-action"
        data-testid="delete-user-action"
        onClick={onDeleteUserClick}
      >
        {t('delete_user')}
      </MenuItemButton>
    )
  } else if (!isUserManaged) {
    buttons.push(
      <MenuItemButton
        key="remove-user-action"
        data-testid="remove-user-action"
        onClick={onRemoveFromGroup}
        className="delete-user-action"
        variant="danger"
      >
        {t('remove_from_group')}
      </MenuItemButton>
    )
  }

  if (buttons.length === 0) {
    buttons.push(
      <DropdownListItem>
        <DropdownItem
          as="button"
          tabIndex={-1}
          data-testid="no-actions-available"
          disabled
        >
          {t('no_actions')}
        </DropdownItem>
      </DropdownListItem>
    )
  }

  return (
    <Dropdown align="end">
      <DropdownToggle
        id={`managed-user-dropdown-${user.email}`}
        bsPrefix="dropdown-table-button-toggle"
      >
        <MaterialIcon type="more_vert" accessibilityLabel={t('actions')} />
      </DropdownToggle>
      <DropdownMenu flip={false}>{buttons}</DropdownMenu>
    </Dropdown>
  )
}

type MenuItemButtonProps = {
  isLoading?: boolean
  'data-testid'?: string
} & Pick<ComponentProps<'button'>, 'children' | 'onClick' | 'className'> &
  Pick<ComponentProps<typeof DropdownItem>, 'variant'>

function MenuItemButton({
  children,
  onClick,
  className,
  isLoading,
  variant,
  'data-testid': dataTestId,
}: MenuItemButtonProps) {
  return (
    <DropdownListItem>
      <DropdownItem
        as="button"
        tabIndex={-1}
        onClick={onClick}
        leadingIcon={
          isLoading ? (
            <Spinner
              animation="border"
              aria-hidden="true"
              size="sm"
              role="status"
            />
          ) : null
        }
        data-testid={dataTestId}
        variant={variant}
      >
        {children}
      </DropdownItem>
    </DropdownListItem>
  )
}
