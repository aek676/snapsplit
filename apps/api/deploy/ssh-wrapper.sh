#!/bin/sh
set -eu
cmd="${SSH_ORIGINAL_COMMAND:-}"
# 1. deploy tag sha-xxxxxxx
case "$cmd" in
	sha-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f])
		exec /opt/apps/snapsplit/deploy-on-host.sh
		;;
esac
# 2. sync: mkdir
case "$cmd" in
	*mkdir*"/opt/apps/snapsplit"*)
		exec sh -c "$cmd"
		;;
esac
# 3. sync: scp -t (old) and sftp-server (new scp/sftp via SFTP)
case "$cmd" in
	scp\ -t*"/opt/apps/snapsplit"*)
		exec sh -c "$cmd"
		;;
	scp*)
		case "$cmd" in
			*"/opt/apps/snapsplit"*) exec sh -c "$cmd" ;;
		esac
		;;
	*sftp-server*)
		exec sh -c "$cmd"
		;;
esac
# 4. sync: chmod +x + chown + ls
case "$cmd" in
	*chmod*"/opt/apps/snapsplit/deploy-on-host.sh"*ls\ -l*"/opt/apps/snapsplit"*)
		exec sh -c "$cmd"
		;;
	*chmod*"/opt/apps/snapsplit/ssh-wrapper.sh"*ls\ -l*"/opt/apps/snapsplit"*)
		exec sh -c "$cmd"
		;;
esac
echo "ssh-wrapper: rejected command '$cmd'" >&2
exit 1
