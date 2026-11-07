export JAVA_HOME=$HOME/dev/jdk-17.0.20.1+1 ANDROID_HOME=$HOME/dev/android-sdk
export KSPW="$(tr -d '\r\n' < $HOME/dev/keys/bb-release.pw)"
export BUILD=$(cat /tmp/tag410)
cd /workspace/boomerang-brawl/mobile && bash build-android.sh > /workspace/out/rel4100/apk410.log 2>&1; echo EXIT $? >> /workspace/out/v4.9/apk49.log
