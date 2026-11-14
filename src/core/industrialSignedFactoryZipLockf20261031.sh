#!/bin/sh
# macOS-only, fixed-argument launcher. Kernel lockf slots are held for the
# entire receiving child lifetime, including across independent Node parents.
# Never queue a third untrusted archive; lockf -t 0 returns 75 on contention.
# -k preserves the pathname at normal exit. After acquiring each lock, compare
# the pathname's device/inode with the parent's checked identity. This detects
# replacement between parent validation and lock acquisition. It does NOT
# defend against a malicious same-UID actor replacing it after this check.
slot0=$1
slot1=$2
identity0=$3
identity1=$4
shift 4
run_locked='expected=$1; slot=$2; shift 2
actual=$(/usr/bin/stat -f "%d:%i" "$slot") || exit 74
[ "$actual" = "$expected" ] || exit 74
exec "$@"'
/usr/bin/lockf -k -t 0 "$slot0" /bin/sh -c "$run_locked" _ "$identity0" "$slot0" "$@"
status=$?
if [ "$status" -ne 75 ]; then
  exit "$status"
fi
/usr/bin/lockf -k -t 0 "$slot1" /bin/sh -c "$run_locked" _ "$identity1" "$slot1" "$@"
exit $?
