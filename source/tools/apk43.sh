export JAVA_HOME=$HOME/dev/jdk-17.0.20.1+1 ANDROID_HOME=$HOME/dev/android-sdk
export KSPW="$(tr -d '\r\n' < $HOME/dev/keys/bb-release.pw)"
export BUILD=$(cat /tmp/tag43)
cd /workspace/boomerang-brawl/mobile && bash build-android.sh > /workspace/out/v4.3-results/apk43.log 2>&1; echo EXIT $? >> /workspace/out/v4.3-results/apk43.log
