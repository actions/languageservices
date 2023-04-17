## This script syncs all five repositories to the current state of main. 
## It will stash changes on the current branch, switch to main, pull and remain on main.

echo "Syncing all repositories to main"

# for each folder in the above directory 
cd ..
for d in */ ; do
    cd $d
    echo "Syncing $d"
    echo "current branch: $(git rev-parse --abbrev-ref HEAD)"
    git stash
    git checkout main
    git pull
    cd ..
done