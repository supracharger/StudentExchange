#!/bin/sh
set -eu
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -n "${JAVA_HOME:-}" ]; then
 JAVA_CMD="$JAVA_HOME/bin/java"
elif [ -x '/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java' ]; then
 JAVA_CMD='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java'
else
 JAVA_CMD=java
fi
exec "$JAVA_CMD" -classpath "$PROJECT_DIR/gradle/wrapper/gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain "$@"
